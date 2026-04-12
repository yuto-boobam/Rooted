import { useState } from "react";
// カードに登録するデータの型を定義する
type CardData = {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
};

function App() {
  // stateについて、状態関数と交信関数を定義する
  // CardData以外は入れてはいけない空の配列を作成する
  const [cards, setCards] = useState<CardData[]>([]);

  // setCardsを利用してカードを生成する関数
  const addCard = () => {
    const newCard: CardData = {
      id: Date.now().toString(),
      title: "新しいカード",
      content: "新しいカードの内容",
      updatedAt: new Date(),
    };
    setCards([...cards, newCard]);
  }

  return (
    <div className="p-8"> {/* 全体の余白 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* グリッドの設定 */}

        <button onClick={addCard} className="bg-slate-100 p-6 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-4 h-full hover:bg-slate-200 transition-colors">
          {/* アイコン用の＋ */}
          <span className="text-2xl text-blue-500 font-bold">＋</span>
          {/* テキスト */}
          <span className="text-slate-600 font-medium">ノートブックを新規作成</span>
        </button>


        {/* card.mapを利用し、カードにcards内の要素をどのように表示するのかを決める */}
        {cards.map((card) => (
          <div key={card.id} className="p-6 bg-white rounded-xl shadow-md border border-gray-200">
            <h2 className="text-xl font-bold">{card.title}</h2>
            <p className="text-gray-600 mt-2">{card.content}</p>
            <div className="text-xs text-gray-400 mt-4">
              更新: {card.updatedAt.toLocaleString()}
            </div>
          </div>
        ))}


      </div>
    </div>
  );

}

export default App;