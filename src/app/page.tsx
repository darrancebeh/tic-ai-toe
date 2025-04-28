'use client';

import { useState, useEffect, useCallback } from 'react';
import { FiGithub, FiLinkedin, FiTwitter, FiMail } from 'react-icons/fi';

// Helper function to calculate the winner
function calculateWinner(squares: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a]; // Return 'X' or 'O'
    }
  }
  // Check for draw (if no winner and board is full)
  if (squares.every(square => square !== null)) {
    return 'Draw';
  }
  return null; // No winner yet
}

// Define the backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Modify Interface for AI Status --- Include avg_q_change
interface AIStatus {
  epsilon: number;
  q_table_size: number;
  initial_state_value: number;
  avg_q_change: number | null; // <-- RE-ADD field
}


export default function Home() {
  // --- Core Game State ---
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [winner, setWinner] = useState<string | null>(null); // 'X', 'O', 'Draw', or null
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X'); // Tracks whose turn it is

  // --- Player vs AI Score ---
  const [score, setScore] = useState({ wins: 0, draws: 0, losses: 0 });

  // --- UI & Interaction State ---
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false); // General thinking/loading indicator

  // --- AI Status ---
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  // --- Game Mode & Self-Play State ---
  const [gameMode, setGameMode] = useState<'playerVsAi' | 'selfPlay'>('playerVsAi');
  const [selfPlayState, setSelfPlayState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
  const [selfPlayRounds, setSelfPlayRounds] = useState<number>(0);
  const [selfPlayStats, setSelfPlayStats] = useState({ xWins: 0, oWins: 0, draws: 0, total: 0 }); // <-- New state for self-play stats
  const SELF_PLAY_DELAY = 150; // Delay in ms for self-play moves

  // --- Fetch AI Status ---
  const fetchAIStatus = useCallback(async () => {
    // console.log("Fetching AI status..."); // Debug log
    try {
      const response = await fetch(`${API_URL}/ai/status`);
      if (!response.ok) {
        throw new Error(`API Status Error: ${response.statusText}`);
      }
      const data: AIStatus = await response.json();
      setAiStatus(data);
    } catch (err) {
      console.error("Failed to fetch AI status:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to AI service.");
      setAiStatus(null); // Clear status on error
    }
  }, []); // No dependencies, safe to memoize

  // --- Trigger AI Learning ---
  const triggerLearning = useCallback(async (finalBoard: (string | null)[], gameWinner: string) => {
    // console.log(`Triggering learning. Winner: ${gameWinner}`); // Debug log
    try {
      const response = await fetch(`${API_URL}/ai/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: finalBoard, winner: gameWinner }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Learn Error: ${errorData.detail || response.statusText}`);
      }
      // console.log("AI learning triggered successfully."); // Debug log
      await fetchAIStatus(); // Fetch updated status after learning
    } catch (err) {
      console.error("Failed to trigger AI learning:", err);
      // Don't necessarily set a board error, just log it
    }
  }, [fetchAIStatus]); // Depends on fetchAIStatus

  // --- Effect to Check Winner & Handle Game End ---
  useEffect(() => {
    const currentWinner = calculateWinner(board);
    if (currentWinner && !winner) { // Only trigger on new winner
      setWinner(currentWinner);
      setIsThinking(false); // Stop thinking indicator

      if (gameMode === 'playerVsAi') {
        // Update score only in Player vs AI mode
        setScore(prevScore => {
          if (currentWinner === 'X') return { ...prevScore, wins: prevScore.wins + 1 };
          if (currentWinner === 'O') return { ...prevScore, losses: prevScore.losses + 1 };
          if (currentWinner === 'Draw') return { ...prevScore, draws: prevScore.draws + 1 };
          return prevScore;
        });
      }

      // Trigger learning regardless of mode (backend handles reward based on 'O')
      triggerLearning(board, currentWinner);

      if (gameMode === 'selfPlay') {
        setSelfPlayState('gameOver'); // Mark self-play round as over
        setSelfPlayRounds(prev => prev + 1);
        // Update self-play stats <-- Update stats here
        setSelfPlayStats(prevStats => {
          const newTotal = prevStats.total + 1;
          let newXWins = prevStats.xWins;
          let newOWins = prevStats.oWins;
          let newDraws = prevStats.draws;
          if (currentWinner === 'X') newXWins++;
          else if (currentWinner === 'O') newOWins++;
          else if (currentWinner === 'Draw') newDraws++;
          return { xWins: newXWins, oWins: newOWins, draws: newDraws, total: newTotal };
        });
      }
    }
  }, [board, winner, gameMode, triggerLearning]); // Dependencies

  // --- Effect for AI Move (Player vs AI) ---
  useEffect(() => {
    if (gameMode === 'playerVsAi' && currentPlayer === 'O' && !winner && isThinking) {
      setError(null);
      const fetchAiMove = async () => {
        // console.log("AI's turn (Player vs AI)"); // Debug log
        try {
          const response = await fetch(`${API_URL}/ai/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: board }),
          });
          if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
          const data = await response.json();
          const aiMoveIndex = data.move;

          if (aiMoveIndex !== null && typeof aiMoveIndex === 'number' && board[aiMoveIndex] === null) {
            const newBoard = [...board];
            newBoard[aiMoveIndex] = 'O';
            setBoard(newBoard); // This triggers the winner check effect
            setCurrentPlayer('X'); // Switch back to player
          } else if (aiMoveIndex !== null) {
            console.error("AI returned invalid move index:", aiMoveIndex);
            setError("AI error: Invalid move received.");
          } else {
             // AI returned null move, likely game already ended but state not updated?
             console.warn("AI returned null move. Checking board state:", board);
             const currentWinner = calculateWinner(board);
             if (!currentWinner) {
                 setError("AI error: Could not determine move.");
             }
          }
        } catch (err) {
          console.error("Failed to fetch AI move:", err);
          setError(err instanceof Error ? err.message : "Failed to connect to AI service.");
        } finally {
          // Only stop thinking if no winner yet (winner effect handles it otherwise)
          if (!calculateWinner(board)) {
              setIsThinking(false);
          }
        }
      };

      // Add delay for UX
      const timer = setTimeout(fetchAiMove, 500);
      return () => clearTimeout(timer);
    }
  }, [gameMode, currentPlayer, winner, board, isThinking]); // Dependencies

  // --- Effect for AI Self-Play Loop ---
  useEffect(() => {
    if (gameMode === 'selfPlay' && selfPlayState === 'playing' && !winner && isThinking) {
      setError(null);
      const fetchAiMove = async () => {
        // console.log(`AI Self-Play: ${currentPlayer}'s turn`); // Debug log
        try {
          const response = await fetch(`${API_URL}/ai/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: board }),
          });
          if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
          const data = await response.json();
          const aiMoveIndex = data.move;

          if (aiMoveIndex !== null && typeof aiMoveIndex === 'number' && board[aiMoveIndex] === null) {
            const newBoard = [...board];
            newBoard[aiMoveIndex] = currentPlayer; // Use the current self-play player
            setBoard(newBoard); // This triggers the winner check effect
            setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X'); // Switch player for next turn
          } else if (aiMoveIndex !== null) {
            console.error("Self-Play AI returned invalid move index:", aiMoveIndex);
            setError("AI error: Invalid move received during self-play.");
            setSelfPlayState('gameOver'); // Halt on error
            setIsThinking(false);
          } else {
             // AI returned null move in self-play
             console.warn("Self-Play AI returned null move. Board:", board);
             const currentWinner = calculateWinner(board);
             if (!currentWinner) {
                 setError("AI error: Could not determine move during self-play.");
                 setSelfPlayState('gameOver'); // Halt on error
                 setIsThinking(false);
             }
             // If there's a winner, the winner effect will handle it.
          }
        } catch (err) {
          console.error("Failed to fetch AI move during self-play:", err);
          setError(err instanceof Error ? err.message : "Failed to connect to AI service.");
          setSelfPlayState('gameOver'); // Halt on error
          setIsThinking(false);
        }
        // Note: isThinking remains true until winner or error, allowing the loop to continue
      };

      // Add delay for visualization
      const timer = setTimeout(fetchAiMove, SELF_PLAY_DELAY);
      return () => clearTimeout(timer);
    }
  }, [gameMode, selfPlayState, currentPlayer, winner, board, isThinking]); // Dependencies

  // --- Initial AI Status Fetch ---
  useEffect(() => {
    fetchAIStatus();
  }, [fetchAIStatus]); // Run once on mount

  // --- Handle Player Click ---
  const handleCellClick = (index: number) => {
    // Ignore click if not player's turn, cell filled, game over, thinking, or in self-play
    if (gameMode !== 'playerVsAi' || currentPlayer !== 'X' || board[index] || winner || isThinking) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setError(null);

    const currentWinner = calculateWinner(newBoard);
    if (!currentWinner) {
      setCurrentPlayer('O'); // Switch to AI's turn
      setIsThinking(true); // Signal AI should think
    }
    // Winner check effect handles game end
  };

  // --- Reset Game Function ---
  const resetGame = (switchToPlayerVsAi = true) => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setCurrentPlayer('X'); // Player 'X' always starts
    setError(null);
    setIsThinking(false);
    if (switchToPlayerVsAi) {
      setGameMode('playerVsAi');
      setSelfPlayState('idle');
      setSelfPlayRounds(0); // Reset self-play counter
      // Reset self-play stats when switching back to player mode <-- Reset here
      setSelfPlayStats({ xWins: 0, oWins: 0, draws: 0, total: 0 });
    } else {
      // Resetting for another round of self-play
      setGameMode('selfPlay');
      setSelfPlayState('playing');
      setIsThinking(true); // Start the self-play loop again
      // Don't reset stats here, only when starting a *new* session via startSelfPlay
    }
    // Score persists across playerVsAi games
    // Fetch status on reset to show latest AI state
    fetchAIStatus();
  };

  // --- Start Self-Play ---
  const startSelfPlay = () => {
    // Reset stats when starting a new self-play session <-- Reset here
    setSelfPlayStats({ xWins: 0, oWins: 0, draws: 0, total: 0 });
    resetGame(false); // Reset board, set mode to selfPlay, start thinking
    setSelfPlayRounds(0);
  };

  // --- Determine Game Status Message ---
  let status;
  if (error) {
    status = `Error: ${error}`;
  } else if (gameMode === 'selfPlay') {
    if (selfPlayState === 'playing') {
      status = `AI Self-Play: Round ${selfPlayRounds + 1} (${currentPlayer}'s turn)`;
    } else if (selfPlayState === 'gameOver') {
      status = winner === 'Draw' ? `Self-Play Round ${selfPlayRounds}: Draw!` : `Self-Play Round ${selfPlayRounds}: ${winner} Wins!`;
    } else {
       status = "AI Self-Play"; // Initial state
    }
  } else { // Player vs AI mode
    if (winner) {
      status = winner === 'Draw' ? 'It\'s a Draw!' : `Winner: ${winner}`;
    } else {
      status = `Next player: ${currentPlayer}`;
    }
  }
  // Add thinking indicator
  if (isThinking && !winner && !error) {
     status += ' (Thinking...)';
  }


  // --- AI Status Indicators ---
  let difficultyIndicator = "Difficulty: Learning...";
  let knowledgeIndicator = "Knowledge Score: Learning...";
  let learningRateIndicator = "Learning Rate: Learning..."; // <-- New indicator

  if (aiStatus) {
    // Difficulty (Epsilon)
    if (aiStatus.epsilon < 0.15) difficultyIndicator = "Difficulty: Hard";
    else if (aiStatus.epsilon < 0.5) difficultyIndicator = "Difficulty: Medium";
    else difficultyIndicator = "Difficulty: Easy";
    difficultyIndicator += ` (ε: ${aiStatus.epsilon.toFixed(3)})`;

    // Knowledge Score (Q-Table Size)
    const MAX_EXPECTED_STATES = 5478;
    const qSize = aiStatus.q_table_size;
    const knowledgeScore = Math.min(100, Math.round((qSize / MAX_EXPECTED_STATES) * 100));
    knowledgeIndicator = `Knowledge Score: ${knowledgeScore}`;

    // Learning Rate (Avg Q Change)
    if (aiStatus.avg_q_change !== null) {
      // Use scientific notation for small values, fixed for larger ones
      const avgChange = aiStatus.avg_q_change;
      const formattedChange = avgChange < 0.0001 && avgChange !== 0
                              ? avgChange.toExponential(2)
                              : avgChange.toFixed(5);
      learningRateIndicator = `Learning Rate: ${formattedChange}`;
    } else {
      learningRateIndicator = "Learning Rate: N/A"; // Before first learn
    }

  } else if (!error) {
     difficultyIndicator = 'Difficulty: Fetching...';
     knowledgeIndicator = 'Knowledge Score: Fetching...';
     learningRateIndicator = 'Learning Rate: Fetching...'; // <-- Placeholder
  }

  const currentYear = new Date().getFullYear();

  // --- Calculate Self-Play Percentages ---
  const xWinPercent = selfPlayStats.total > 0 ? ((selfPlayStats.xWins / selfPlayStats.total) * 100).toFixed(1) : '0.0';
  const oWinPercent = selfPlayStats.total > 0 ? ((selfPlayStats.oWins / selfPlayStats.total) * 100).toFixed(1) : '0.0';
  const drawPercent = selfPlayStats.total > 0 ? ((selfPlayStats.draws / selfPlayStats.total) * 100).toFixed(1) : '0.0';

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="flex flex-col items-center justify-center flex-grow w-full max-w-md">
        <h1 className="text-4xl font-bold mb-4">Tic-my-Toe</h1> {/* Reduced margin */}

        {/* Game Status */}
        <div className={`mb-1 text-xl h-6 text-center ${error ? 'text-red-500' : ''}`}> {/* Centered text */}
          {status}
        </div>

         {/* AI Status Display */}
         <div className="mb-4 text-sm text-gray-400 h-auto min-h-[4rem] flex flex-col items-center text-center gap-y-1"> {/* Increased min-height */}
           {/* Display Difficulty (Epsilon) */}
           <div>{difficultyIndicator}</div>
           {/* Display Knowledge Score */}
           <div>{knowledgeIndicator}</div>
           {/* Display Learning Rate (Avg Q Change) */}
           <div>{learningRateIndicator}</div> {/* <-- Add new indicator display */}
           {/* Display Self-Play Stats */}
           {selfPlayStats.total > 0 && (
             <div className="mt-1 text-xs">
               Self-Play ({selfPlayStats.total} rounds): X Wins: {xWinPercent}% | O Wins: {oWinPercent}% | Draws: {drawPercent}%
             </div>
           )}
         </div>

        {/* Game Board */}
        <div className="grid grid-cols-3 gap-2 w-64 h-64 border-2 border-foreground mb-6">
          {board.map((cell: string | null, index: number) => (
            <button
              key={index}
              className={`flex items-center justify-center border border-foreground text-4xl font-bold hover:bg-foreground/10
                          ${cell === 'X' ? 'text-blue-400' : 'text-red-400'} // Color X and O
                          disabled:opacity-60 disabled:cursor-not-allowed`}
              onClick={() => handleCellClick(index)}
              // Disable button if cell filled, game over, thinking, or not player's turn in PvP mode
              disabled={!!cell || !!winner || isThinking || (gameMode === 'playerVsAi' && currentPlayer !== 'X') || gameMode === 'selfPlay'}
            >
              {cell || ' '}
            </button>
          ))}
        </div>

         {/* Control Buttons */}
         <div className="flex flex-wrap justify-center gap-4 mb-6">
            {/* Show Reset/Play Again in PlayerVsAi mode when game ends or error */}
            {gameMode === 'playerVsAi' && (winner || error) && (
              <button
                onClick={() => resetGame(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                {error ? 'Reset Game' : 'Play Again?'}
              </button>
            )}

           {/* Show Start Self-Play button only when idle in PlayerVsAi mode */}
           {gameMode === 'playerVsAi' && !winner && !isThinking && !error && (
             <button
               onClick={startSelfPlay}
               className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
             >
               Let AI Self-Train
             </button>
           )}

           {/* Show controls during/after self-play */}
           {gameMode === 'selfPlay' && selfPlayState === 'gameOver' && (
             <>
               <button
                 onClick={() => resetGame(false)} // Continue self-play
                 className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
               >
                 Continue Self-Play
               </button>
               <button
                 onClick={() => resetGame(true)} // Switch to player vs AI
                 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
               >
                 Play vs AI Now
               </button>
             </>
           )}
         </div>


        {/* Win Rate Counter (Only for Player vs AI) */}
        {gameMode === 'playerVsAi' && (
          <div className="mt-4 text-center"> {/* Reduced margin */}
            <h2 className="text-2xl mb-2">Your Score vs AI</h2>
            <p>Wins: {score.wins} | Draws: {score.draws} | Losses: {score.losses}</p>
          </div>
        )}
      </div>

      {/* Footer remains the same */}
      <footer
        className="w-full py-4 px-4 sm:px-8 bg-opacity-50 text-gray-400 text-sm font-[family-name:var(--font-geist-mono)] border-t border-gray-800 mt-auto" // Ensure footer is at bottom
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          {/* Social Links */}
          <div className="flex gap-5">
            <a
              href="https://github.com/darrancebeh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiGithub className="w-5 h-5" />
            </a>
            <a
              href="https://linkedin.com/in/darrancebeh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiLinkedin className="w-5 h-5" />
            </a>
            <a
              href="https://x.com/quant_in_my"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X Profile"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiTwitter className="w-5 h-5" />
            </a>
            <a
              href="mailto:darrancebeh@gmail.com"
              aria-label="Send Email"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiMail className="w-5 h-5" />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-center sm:text-right">
            <p>&copy; {currentYear} Darrance Beh Heng Shek. All Rights Reserved.</p>
            <p className="text-xs text-gray-500 mt-1">
              Built with Next.js, React, FastAPI, Pydantic, Tailwind CSS. (Custom implementation of Q-learning algorithm)
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
