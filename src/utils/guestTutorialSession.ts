// src/utils/guestTutorialSession.ts
// ゲスト（ログイン無しのお試し閲覧）が「サンプルプロジェクトを開く」誘導を
// 一度でも達成したかどうかを、タブ/ブラウザを閉じるまでだけ覚えておくためのフラグ。
//
// Combo-LABの同種フラグ(guestTutorialSession.ts)と同じ設計。ゲストのデータは
// zustand persistでlocalStorageへ永続化されないため対応するstoreフラグは無いが、
// 同じブラウザで後から本アカウントへログインした際に誤って影響しないよう、
// あえてlocalStorageではなくsessionStorageを使う。

const GUEST_TUTORIAL_SEEN_KEY = 'rooted-guest-tutorial-seen';

export function hasGuestSeenTutorial(): boolean {
  try {
    return sessionStorage.getItem(GUEST_TUTORIAL_SEEN_KEY) === '1';
  } catch {
    // プライベートブラウジング等でsessionStorageが使えない環境では、常に未達成扱いにする
    return false;
  }
}

export function markGuestTutorialSeen(): void {
  try {
    sessionStorage.setItem(GUEST_TUTORIAL_SEEN_KEY, '1');
  } catch {
    // 保存できなくても致命的ではない(次回また誘導が出るだけ)
  }
}
