import { useState } from "react";
// カードに登録するデータの型を定義する
type CardData = {
  id: string;
  title: string;
  additional: string;
  updatedAt: Date;
};

// すべてのカードに共通するベーススタイル（背景色は含まない）
const cardBaseStyle = "p-6 rounded-2xl shadow-sm border border-slate-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer";

// 「新規作成」ボタン専用のスタイル
const addCardButtonStyle = `${cardBaseStyle} bg-slate-100 border-dashed border-2 border-slate-300 flex flex-col items-center justify-center gap-4 h-full hover:bg-slate-300 group`;

function App() {
  // stateについて、状態関数と更新関数を定義する
  // CardData以外は入れてはいけない空の配列を作成する
  const [cards, setCards] = useState<CardData[]>([]);

  // モーダル用のステート、デフォルトをfalseにする
  const [isModalOpen, setIsModalOpen] = useState(false);

  // inputTextのステート
  const [inputText, setInputText] = useState("");

  // setCardsを利用してカードを生成する関数
  const addCard = () => {
    const newCard: CardData = {
      id: Date.now().toString(),
      title: "新しいカード",
      additional: "追加情報",
      updatedAt: new Date(),
    };
    setCards([...cards, newCard]);
  }

  return (
    <div className="p-8"> {/* 全体の余白 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* グリッドの設定 */}

        <button onClick={() => setIsModalOpen(true)} className={addCardButtonStyle}>
          {/* アイコン用の＋ */}
          <span className="text-2xl text-blue-500 font-bold group-hover:scale-125 transition-transform">＋</span>
          <span className="text-slate-600 font-medium">ノートブックを新規作成</span>
        </button>

        {/* ボタンをクリックしたら、まずモーダルをオープンする */}
        {isModalOpen && (
          // モーダルを開いている時の背景
          < div onClick={() => setIsModalOpen(false)} className="fixed inset-0 bg-black/50 flex items-center justify-center">
            {/* モーダルの本体 */}
            <div className="bg-white p-8 rounded-2xl shadow-xl">
              <h2>新しいノートのタイトルを入力</h2>
              {/* ここに後で input などを追加します */}
              <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} />
              <button onClick={() => setIsModalOpen(false)}>作成</button>
            </div>
          </div>
        )}



        {/* card.mapを利用し、カードにcards内の要素をどのように表示するのかを決める */}
        {cards.map((card) => (
          <div key={card.id} className={`${cardBaseStyle} bg-white hover:bg-slate-50`}>
            <h2 className="text-xl font-bold">{card.title}</h2>
            <p className="text-gray-600 mt-2">{card.additional}</p>
            <div className="text-xs text-gray-400 mt-4">
              更新: {card.updatedAt.toLocaleString()}
            </div>
          </div>
        ))}


      </div>
    </div >
  );

}

export default App;