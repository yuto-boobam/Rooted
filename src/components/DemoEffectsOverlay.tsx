// src/components/DemoEffectsOverlay.tsx
// デモ録画用の操作可視化演出。有効化中のみ、Enter/Tab/Escapeキーを押すと画面中央に
// キー名がポップ表示され、クリックした位置には波紋エフェクトが広がる。就活面接等で
// 画面録画する際に「今どんな操作をしたか」を視聴者に伝えるための演出で、通常利用では
// RightDrawerPanel.tsxの「演出 ON/OFF」ボタンでOFFのままにしておく想定
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppStore } from '../store';

const KEY_LABELS: Record<string, string> = {
  Enter: 'Enter ⏎',
  Tab: 'Tab ⇥',
  Escape: 'Esc ⎋',
};

const KEY_POP_DURATION_MS = 900;
const RIPPLE_DURATION_MS = 550;
const TRAIL_DOT_DURATION_MS = 420;
// この距離(px)以上カーソルが動くたびに軌跡の点を追加する。dragover は非常に高頻度で
// 発火するため、間引かないと点が密集しすぎて塗りつぶしたようになってしまう
const TRAIL_MIN_DISTANCE = 14;

type KeyPop = { id: number; label: string };
type Ripple = { id: number; x: number; y: number };
type TrailDot = { id: number; x: number; y: number };

let nextEffectId = 0;

export default function DemoEffectsOverlay() {
  const isDemoEffectsEnabled = useAppStore((state) => state.isDemoEffectsEnabled);

  const [keyPop, setKeyPop] = useState<KeyPop | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [trailDots, setTrailDots] = useState<TrailDot[]>([]);
  const keyPopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const trailTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const lastTrailPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isDemoEffectsEnabled) return;

    const rippleTimeouts = rippleTimeoutsRef.current;
    const trailTimeouts = trailTimeoutsRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 長押しによる自動リピートは無視（毎回アニメーションが再生されてしまうため）
      if (event.repeat) return;

      const label = KEY_LABELS[event.key];
      if (!label) return;

      if (keyPopTimeoutRef.current) clearTimeout(keyPopTimeoutRef.current);

      const id = nextEffectId++;
      setKeyPop({ id, label });
      keyPopTimeoutRef.current = setTimeout(() => {
        setKeyPop((current) => (current?.id === id ? null : current));
      }, KEY_POP_DURATION_MS);
    };

    const handleMouseDown = (event: MouseEvent) => {
      const id = nextEffectId++;
      setRipples((current) => [...current, { id, x: event.clientX, y: event.clientY }]);
      const timeoutId = setTimeout(() => {
        setRipples((current) => current.filter((ripple) => ripple.id !== id));
        rippleTimeouts.delete(timeoutId);
      }, RIPPLE_DURATION_MS);
      rippleTimeouts.add(timeoutId);
    };

    // ネイティブのドラッグ&ドロップ（ノードの並び替え・コピー貼り付け）中は
    // dragover がカーソル位置を伴って連続発火するので、それを軌跡の点として使う。
    // window捕捉なので、どの要素からドラッグが始まってもツリー・ドロワーどちらでも拾える
    const handleDragOver = (event: DragEvent) => {
      const last = lastTrailPointRef.current;
      const dx = last ? event.clientX - last.x : Infinity;
      const dy = last ? event.clientY - last.y : Infinity;
      if (Math.hypot(dx, dy) < TRAIL_MIN_DISTANCE) return;

      lastTrailPointRef.current = { x: event.clientX, y: event.clientY };

      const id = nextEffectId++;
      setTrailDots((current) => [...current, { id, x: event.clientX, y: event.clientY }]);
      const timeoutId = setTimeout(() => {
        setTrailDots((current) => current.filter((dot) => dot.id !== id));
        trailTimeouts.delete(timeoutId);
      }, TRAIL_DOT_DURATION_MS);
      trailTimeouts.add(timeoutId);
    };

    const handleDragEnd = () => {
      lastTrailPointRef.current = null;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('dragover', handleDragOver, true);
    window.addEventListener('dragend', handleDragEnd, true);
    window.addEventListener('drop', handleDragEnd, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('dragover', handleDragOver, true);
      window.removeEventListener('dragend', handleDragEnd, true);
      window.removeEventListener('drop', handleDragEnd, true);
      if (keyPopTimeoutRef.current) clearTimeout(keyPopTimeoutRef.current);
      rippleTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      rippleTimeouts.clear();
      trailTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      trailTimeouts.clear();
      lastTrailPointRef.current = null;
      setKeyPop(null);
      setRipples([]);
      setTrailDots([]);
    };
  }, [isDemoEffectsEnabled]);

  if (!isDemoEffectsEnabled) return null;

  return (
    <div style={styles.container}>
      {keyPop && (
        <div key={keyPop.id} className="demo-key-pop" style={styles.keyPop}>
          {keyPop.label}
        </div>
      )}

      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="demo-ripple"
          style={{ ...styles.ripple, left: ripple.x, top: ripple.y }}
        />
      ))}

      {trailDots.map((dot) => (
        <div
          key={dot.id}
          className="demo-trail-dot"
          style={{ ...styles.trailDot, left: dot.x, top: dot.y }}
        />
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none',
  },

  keyPop: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    padding: '14px 28px',
    borderRadius: 16,
    background: 'rgba(15, 15, 20, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    color: '#fff',
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: 0.5,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    whiteSpace: 'nowrap',
  },

  ripple: {
    position: 'fixed',
    width: 70,
    height: 70,
    borderRadius: '50%',
    border: '4px solid #fde047',
    background: 'rgba(253, 224, 71, 0.35)',
    boxShadow: '0 0 18px 4px rgba(253, 224, 71, 0.55)',
  },

  // ドラッグ中の軌跡の点。波紋より小さく、拡大せずその場でフェードするだけにして
  // 「クリック」の波紋と「ドラッグ移動」の軌跡を見分けやすくする
  trailDot: {
    position: 'fixed',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#fde047',
    boxShadow: '0 0 10px 3px rgba(253, 224, 71, 0.6)',
  },
};
