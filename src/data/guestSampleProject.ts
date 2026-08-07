// src/data/guestSampleProject.ts
// ゲストモード用のサンプルプロジェクト定義。
// normalizeProject() に通す前提の緩い形（Partial<Project>）で用意し、
// progress・priorityOrder・backgroundColor 等はstore側の正規化処理に任せる。

import type { Project } from '../types';

/** ゲストモードで毎回重複生成しないための固定ID */
export const GUEST_SAMPLE_PROJECT_ID = 'guest-sample-project';

function offsetDateKey(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSampleProjectData() {
  return {
    id: GUEST_SAMPLE_PROJECT_ID,
    title: 'サンプルプロジェクト',
    description:
      'ゲストモードの操作感を確認するためのサンプルです。自由に編集・削除して試してください。',
    icon: '🌱',
    color: '#3b82f6',
    createdBy: 'ゲスト',
    rootTask: {
      title: 'サンプルプロジェクト',
      memo: '',
      detailMemo: '',
      completed: false,
      createdBy: 'ゲスト',
      children: [
        {
          title: '企画',
          memo: '要件を整理するフェーズ',
          detailMemo: '',
          completed: false,
          createdBy: 'ゲスト',
          children: [
            {
              title: '要件定義書を作成',
              memo: '主要機能と非機能要件をまとめた',
              detailMemo: '',
              completed: true,
              createdBy: 'ゲスト',
              children: [],
            },
            {
              title: '競合調査',
              memo: '',
              detailMemo: '',
              completed: true,
              createdBy: 'ゲスト',
              children: [],
            },
          ],
        },
        {
          title: '設計',
          memo: 'UI/UXとDB構成を固める',
          detailMemo: '',
          completed: false,
          isPriority: true,
          dueDate: offsetDateKey(2),
          createdBy: 'ゲスト',
          children: [
            {
              title: '画面設計',
              memo: 'Figmaでワイヤーフレーム作成済み',
              detailMemo: '',
              completed: true,
              isPriority: true,
              dueDate: offsetDateKey(1),
              createdBy: 'ゲスト',
              children: [],
            },
            {
              title: 'DB設計',
              memo: 'テーブル定義の見直しに時間がかかっている',
              detailMemo: '正規化のやり直しが必要かもしれない',
              completed: false,
              dueDate: offsetDateKey(-2),
              createdBy: 'ゲスト',
              children: [],
            },
          ],
        },
        {
          title: '実装',
          memo: 'フロント・バックともに着手中',
          detailMemo: '',
          completed: false,
          createdBy: 'ゲスト',
          children: [
            {
              title: 'フロントエンド実装',
              memo: '',
              detailMemo: '',
              completed: false,
              isPriority: true,
              dueDate: offsetDateKey(10),
              createdBy: 'ゲスト',
              children: [],
            },
            {
              title: 'バックエンド実装',
              memo: '',
              detailMemo: '',
              completed: false,
              dueDate: offsetDateKey(10),
              createdBy: 'ゲスト',
              children: [],
            },
          ],
        },
        {
          title: 'リリース準備',
          memo: '本番環境へのデプロイ手順を確認',
          detailMemo: 'デプロイ後は動作確認チェックリストに沿って検証する',
          completed: false,
          dueDate: offsetDateKey(5),
          createdBy: 'ゲスト',
          children: [],
        },
      ],
    },
  };
}

export function makeGuestSampleProject(): Partial<Project> {
  return buildSampleProjectData() as unknown as Partial<Project>;
}
