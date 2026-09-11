/**
 * CameraManager — singleton that keeps one camera MediaStream alive
 * across route navigations so the browser doesn't re-prompt for permission.
 *
 * Usage:
 *   const stream = await CameraManager.getStream();   // reuses if active
 *   CameraManager.release();                          // explicit stop (logout, etc.)
 */

let _stream: MediaStream | null = null;
let _pending: Promise<MediaStream> | null = null;

const CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
  audio: false,
};

function isStreamActive(stream: MediaStream): boolean {
  return stream.getVideoTracks().some((t) => t.readyState === 'live');
}

export const CameraManager = {
  /** Get the cached MediaStream, or create one. */
  async getStream(): Promise<MediaStream> {
    if (_stream && isStreamActive(_stream)) return _stream;

    // If another caller already requested, wait for the same promise
    if (_pending) return _pending;

    _pending = navigator.mediaDevices.getUserMedia(CONSTRAINTS).then((stream) => {
      _stream = stream;
      _pending = null;

      // Auto-cleanup if all tracks end externally (user revokes in browser settings)
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (_stream === stream) _stream = null;
        });
      });

      return stream;
    }).catch((err) => {
      _pending = null;
      throw err;
    });

    return _pending;
  },

  /** Stop all tracks and discard the cached stream. */
  release() {
    if (_stream) {
      _stream.getTracks().forEach((t) => t.stop());
      _stream = null;
    }
    _pending = null;
  },

  /** True if a live stream exists. */
  get active(): boolean {
    return !!_stream && isStreamActive(_stream);
  },
};
