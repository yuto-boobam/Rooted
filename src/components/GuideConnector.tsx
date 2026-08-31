// src/components/GuideConnector.tsx
// ゲスト向け誘導ガイド用のコネクター。常に「操作方法」ノードの真下に吹き出しを1つ
// 表示し、その時々の操作対象(自分自身／新しくできた子ノード／チェックボックス／
// 開閉トグル)まで点線と丸印を伸ばして指し示す。ConnectionsOverlay.tsxと同じ
// 「DOM座標を毎フレーム実測してSVGを引き直す」手法を使うため、ズーム・パン・
// レイアウトの変化に自動で追従する。

import { useEffect, useRef, useState } from 'react';

export type GuideTargetAnchor = 'top' | 'bottom' | 'center' | 'rightMiddle' | 'checkbox';

type Geometry = {
  bubbleX: number;
  bubbleY: number;
  targetX: number;
  targetY: number;
};

function computeLocalPoint(
  rect: DOMRect,
  origin: DOMRect,
  zoom: number,
  anchor: GuideTargetAnchor,
): { x: number; y: number } {
  const toLocal = (x: number, y: number) => ({
    x: (x - origin.left) / zoom,
    y: (y - origin.top) / zoom,
  });

  switch (anchor) {
    case 'bottom':
      return toLocal(rect.left + rect.width / 2, rect.bottom);
    case 'center':
      return toLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
    case 'rightMiddle':
      return toLocal(rect.right, rect.top + rect.height / 2);
    case 'checkbox':
      // TaskNodeCard.tsxのチェックボックスの実測位置に近い、カード左上寄りの固定オフセット
      return toLocal(rect.left + 15, rect.top + 15);
    case 'top':
    default:
      return toLocal(rect.left + rect.width / 2, rect.top);
  }
}

export function GuideConnector({
  anchorNodeId,
  targetNodeId,
  targetAnchor,
  text,
  zoom,
  idPrefix = 'node-',
}: {
  /** 吹き出し自体が常にこのノードの真下に表示される(「操作方法」ノードを想定) */
  anchorNodeId: string;
  /** 点線の先端(丸印)が指す、今回の操作対象ノード */
  targetNodeId: string;
  targetAnchor: GuideTargetAnchor;
  text: string;
  zoom: number;
  idPrefix?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    let animationFrameId = 0;

    const update = () => {
      const svg = svgRef.current;
      const anchorEl = document.getElementById(`${idPrefix}${anchorNodeId}`);
      const targetEl = document.getElementById(`${idPrefix}${targetNodeId}`);

      if (svg && anchorEl && targetEl) {
        const origin = svg.getBoundingClientRect();
        const bubblePoint = computeLocalPoint(
          anchorEl.getBoundingClientRect(),
          origin,
          zoom,
          'bottom',
        );
        const targetPoint = computeLocalPoint(
          targetEl.getBoundingClientRect(),
          origin,
          zoom,
          targetAnchor,
        );

        setGeometry({
          bubbleX: bubblePoint.x,
          bubbleY: bubblePoint.y + 14,
          targetX: targetPoint.x,
          targetY: targetPoint.y,
        });
      }

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationFrameId);
  }, [anchorNodeId, targetNodeId, targetAnchor, zoom, idPrefix]);

  const bubbleWidth = 168;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 30,
      }}
    >
      {geometry && (
        <>
          <line
            x1={geometry.bubbleX}
            y1={geometry.bubbleY}
            x2={geometry.targetX}
            y2={geometry.targetY}
            stroke="var(--accent)"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <circle cx={geometry.targetX} cy={geometry.targetY} r={3.6} fill="var(--accent)" />

          <foreignObject
            x={geometry.bubbleX - bubbleWidth / 2}
            y={geometry.bubbleY}
            width={bubbleWidth}
            height={70}
          >
            <div
              className="tutorial-guide-bubble"
              style={{
                width: bubbleWidth,
                padding: '6px 9px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 9.6,
                fontWeight: 800,
                lineHeight: 1.4,
                textAlign: 'center',
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
              }}
            >
              {text}
            </div>
          </foreignObject>
        </>
      )}
    </svg>
  );
}
