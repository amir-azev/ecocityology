import React from "react";
import TabBar from "@/components/TabBar";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md p-4 bg-white shadow-md rounded-lg">
        <TabBar />
      </div>
    </div>
  );
}

export default App;
