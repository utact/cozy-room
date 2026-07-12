/**
 * 보이스챗 — 방 전원 P2P 오디오 메시 (WebRTC).
 * 시그널링은 릴레이 서버의 signal 메시지를 사용한다 (호스트=0, 게스트=1..3).
 *
 * 연결: 새로 입장한 쪽이 기존 피어 전원에게 오퍼를 보낸다.
 * 글레어(동시 오퍼)는 perfect negotiation의 polite 규칙(내 id가 크면 양보)으로 해소.
 * 마이크는 V로 켜기/음소거 — 트랙 replaceTrack/enabled 방식이라 재협상이 없다.
 */

import type { NetChannel } from './net';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

interface Peer {
  pc: RTCPeerConnection;
  transceiver: RTCRtpTransceiver;
  makingOffer: boolean;
  ignoreOffer: boolean;
  audioEl: HTMLAudioElement | null;
}

export type VoiceState = 'idle' | 'requesting' | 'on' | 'muted' | 'denied';

export class VoiceChat {
  private peers = new Map<number, Peer>();
  private stream: MediaStream | null = null;
  state: VoiceState = 'idle';
  onStateChange: (state: VoiceState, peers: number) => void = () => {};

  constructor(private channel: NetChannel, private myId: number) {
    channel.onSignal((from, data) => this.handleSignal(from, data));
  }

  /** 새 세션 시작 시 기존 피어들에게 연결 개시 (조인자가 오퍼) */
  connectToPeers(peerIds: number[]) {
    for (const id of peerIds) {
      if (id !== this.myId && !this.peers.has(id)) this.ensurePeer(id, true);
    }
  }

  peerJoined(_id: number) {
    // 새 피어가 우리에게 오퍼를 보낸다 — 시그널 수신 시 ensurePeer로 응답
  }

  peerLeft(id: number) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.pc.close();
      peer.audioEl?.remove();
      this.peers.delete(id);
      this.emit();
    }
  }

  /** V 키 — 첫 호출은 마이크 요청, 이후 음소거 토글 */
  async toggle() {
    if (this.state === 'requesting') return;
    if (!this.stream) {
      this.state = 'requesting';
      this.emit();
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        this.state = 'denied';
        this.emit();
        return;
      }
      const track = this.stream.getAudioTracks()[0];
      for (const peer of this.peers.values()) {
        await peer.transceiver.sender.replaceTrack(track).catch(() => {});
      }
      this.state = 'on';
    } else {
      const track = this.stream.getAudioTracks()[0];
      track.enabled = !track.enabled;
      this.state = track.enabled ? 'on' : 'muted';
    }
    this.emit();
  }

  private emit() {
    const connected = [...this.peers.values()].filter(
      (p) => p.pc.connectionState === 'connected',
    ).length;
    this.onStateChange(this.state, connected);
  }

  private ensurePeer(id: number, initiate: boolean): Peer {
    let peer = this.peers.get(id);
    if (peer) return peer;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (this.stream) {
      transceiver.sender.replaceTrack(this.stream.getAudioTracks()[0]).catch(() => {});
    }
    peer = { pc, transceiver, makingOffer: false, ignoreOffer: false, audioEl: null };
    this.peers.set(id, peer);

    pc.onnegotiationneeded = async () => {
      try {
        peer!.makingOffer = true;
        await pc.setLocalDescription();
        this.channel.signal(id, { description: pc.localDescription });
      } finally {
        peer!.makingOffer = false;
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.channel.signal(id, { candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      if (!peer!.audioEl) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        peer!.audioEl = audio;
      }
      peer!.audioEl.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      this.emit();
    };
    pc.onconnectionstatechange = () => this.emit();

    if (initiate) {
      // addTransceiver가 negotiationneeded를 발화시켜 오퍼가 나간다
    }
    return peer;
  }

  private async handleSignal(from: number, data: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) {
    const peer = this.ensurePeer(from, false);
    const { pc } = peer;
    const polite = this.myId > from;
    try {
      if (data.description) {
        const collision =
          data.description.type === 'offer' &&
          (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(data.description);
        if (data.description.type === 'offer') {
          await pc.setLocalDescription();
          this.channel.signal(from, { description: pc.localDescription });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(data.candidate).catch((err) => {
          if (!peer.ignoreOffer) throw err;
        });
      }
    } catch (err) {
      console.warn('[voice] 시그널 처리 실패:', err);
    }
  }
}
