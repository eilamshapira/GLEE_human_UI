import { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useGameState } from "./hooks/useGameState";
import { createGame } from "./api";
import GameSetup from "./components/GameSetup";
import GameBoard from "./components/GameBoard";
import GameResult from "./components/GameResult";
import type { GameConfig } from "./types";

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { lastMessage, connected, send } = useWebSocket(sessionId);
  const gameState = useGameState(lastMessage);

  const handleStart = async (config: GameConfig) => {
    setIsCreating(true);
    try {
      const result = await createGame(config);
      setSessionId(result.session_id);
      gameState.setSessionId(result.session_id);
      gameState.setConfig(config);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlayAgain = () => {
    setSessionId(null);
    gameState.reset();
  };

  // No session yet — show setup
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <GameSetup onStart={handleStart} isCreating={isCreating} />
      </div>
    );
  }

  // Game finished
  if (gameState.state.finished) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <GameResult
          outcome={gameState.state.outcome}
          finalAlice={gameState.state.finalAlice}
          finalBob={gameState.state.finalBob}
          gameParams={gameState.state.gameParams}
          playerRole={gameState.state.playerRole}
          onPlayAgain={handlePlayAgain}
        />
      </div>
    );
  }

  // Active game
  return (
    <div className="min-h-screen bg-gray-950">
      <GameBoard
        state={gameState.state}
        connected={connected}
        send={send}
        setSliderPct={gameState.setSliderPct}
        setMessageText={gameState.setMessageText}
        toggleTone={gameState.toggleTone}
        clearForm={gameState.clearForm}
      />
    </div>
  );
}
