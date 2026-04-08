function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-extrabold text-blue-600 mb-4 text-center">
          Tailwind CSS v4 + React
        </h1>
        <p className="text-gray-600 text-center leading-relaxed">
          セットアップが正常に完了しました！<br />
          Viteプラグイン方式による最新の構成です。
        </p>
        <div className="mt-6 flex justify-center">
          <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium">
            Ready to build 🚀
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;