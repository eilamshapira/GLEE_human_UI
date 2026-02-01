import { useWebSocket } from "./hooks/useWebSocket";
import { useGameState } from "./hooks/useGameState";
import { createGame } from "./api";
import GameSetup from "./components/GameSetup";
import GameBoard from "./components/GameBoard";
import GameResult from "./components/GameResult";
import type { GameConfig } from "./types";

export default function App() {
  const { state, setSessionId, setConfig, ...actions } = useGameState(null);

  // We need the WS hook at this level, but sessionId drives it
  const { lastMessage, connected, send } = useWebSocket(state.sessionId);

  // Feed WS messages into game state via a second useGameState-compatible hook
  // Instead, we use a combined approach:
  const gameState = useGameState(lastMessage);

  const handleStart = async (config: GameConfig) => {
    const result = await createGame(config);
    gameState.setSessionId(result.session_id);
    gameState.setConfig(config);
  };

  const handlePlayAgain = () => {
    gameState.reset();
  };

  // No session yet — show setup
  if (!gameState.state.sessionId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <GameSetup onStart={handleStart} />
      </div>
    );
  }

  // Game finished
  if (gameState.state.finished) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <GameResult
          outcome={gameState.state.outcome}
          messages={gameState.state.messages}
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
