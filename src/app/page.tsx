'use client';

import { useState, useEffect } from 'react';

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

// --- Modify Interface for AI Status ---
interface AIStatus {
  epsilon: number;
  q_table_size: number;
  initial_state_value: number; // Added field
}

export default function Home() {
  // Represents the 3x3 board, null = empty, 'X' = player, 'O' = AI
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true); // Player 'X' starts
  const [winner, setWinner] = useState<string | null>(null);
  const [score, setScore] = useState({ wins: 0, draws: 0, losses: 0 });
  const [isAiTurn, setIsAiTurn] = useState<boolean>(false); // Track if it's AI's turn
  const [error, setError] = useState<string | null>(null); // State for API errors
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  // --- Effect to Check Winner and Trigger Learning --- 
  useEffect(() => {
    const currentWinner = calculateWinner(board);
    if (currentWinner && !winner) { // Check if winner changed from null
      setWinner(currentWinner);

      // --- Trigger AI Learning --- 
      const triggerLearning = async () => {
        try {
          const response = await fetch(`${API_URL}/ai/learn`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ board: board, winner: currentWinner }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Learn Error: ${errorData.detail || response.statusText}`);
          }
          console.log("AI learning triggered successfully.");
          // --- Fetch updated AI status after learning --- 
          fetchAIStatus(); // Call function to update status display
        } catch (err) {
          console.error("Failed to trigger AI learning:", err);
        }
      };
      triggerLearning();
    }
  }, [board, winner]); // Depend on board and winner state

  // --- Score Update Effect --- 
  useEffect(() => {
    if (winner) {
      setScore(prevScore => {
        if (winner === 'X') {
          return { ...prevScore, wins: prevScore.wins + 1 };
        } else if (winner === 'O') {
          return { ...prevScore, losses: prevScore.losses + 1 };
        } else if (winner === 'Draw') {
          return { ...prevScore, draws: prevScore.draws + 1 };
        }
        return prevScore;
      });
    }
  }, [winner]); // Run only when winner changes

  // --- AI Turn Trigger Effect (Calls Backend API) ---
  useEffect(() => {
    // Trigger AI move if it's O's turn, game not over, and AI isn't already thinking
    if (!xIsNext && !winner && isAiTurn) {
      setError(null); // Clear previous errors
      const fetchAiMove = async () => {
        try {
          const response = await fetch(`${API_URL}/ai/move`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ board: board }),
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
          }

          const data = await response.json();
          const aiMoveIndex = data.move;

          if (aiMoveIndex !== null && typeof aiMoveIndex === 'number' && board[aiMoveIndex] === null) {
            const newBoard = [...board];
            newBoard[aiMoveIndex] = 'O';
            setBoard(newBoard); // Update board with AI move
            // Winner check is now handled by the separate useEffect
          } else if (aiMoveIndex !== null) {
            // Handle case where API returns an invalid move (e.g., already filled cell)
            console.error("AI returned invalid move index:", aiMoveIndex);
            setError("AI error: Invalid move received.");
          }
          // If aiMoveIndex is null, game might be over or no moves (handled by backend)

        } catch (err) {
          console.error("Failed to fetch AI move:", err);
          setError(err instanceof Error ? err.message : "Failed to connect to AI service.");
        } finally {
          // Regardless of success or error, switch turn back and end AI thinking state
          // unless an error occurred that should halt the game
          if (!(error && error.startsWith("AI error"))) { // Don't switch turn if AI made invalid move
             setXIsNext(true);
          }
          setIsAiTurn(false); // AI turn finished
        }
      };

      // Add a small delay before calling API for better UX
      const timer = setTimeout(fetchAiMove, 500); // 500ms delay
      return () => clearTimeout(timer); // Cleanup timer on component unmount or dependency change
    }
  }, [xIsNext, winner, board, isAiTurn, error]); // Dependencies for the effect

  // --- NEW: Effect to Fetch AI Status Periodically ---
  const fetchAIStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/ai/status`);
      if (!response.ok) {
        throw new Error(`API Status Error: ${response.statusText}`);
      }
      const data: AIStatus = await response.json();
      setAiStatus(data);
    } catch (err) {
      console.error("Failed to fetch AI status:", err);
      // Optionally set an error state or just log it
    }
  };

  useEffect(() => {
    // Fetch status initially
    fetchAIStatus();

    // Optional: Fetch status periodically (e.g., every 10 seconds)
    // const intervalId = setInterval(fetchAIStatus, 10000);
    // return () => clearInterval(intervalId); // Cleanup interval on unmount

  }, []); // Empty dependency array means run once on mount

  const handleCellClick = (index: number) => {
    // Ignore click if cell is filled or game is over
    if (board[index] || winner || !xIsNext || isAiTurn) { // Added isAiTurn check
      return;
    }

    const newBoard = [...board];
    newBoard[index] = 'X'; // Player always plays 'X'
    setBoard(newBoard);
    setError(null); // Clear error on player move

    // Check for winner/draw immediately after player's move
    const currentWinner = calculateWinner(newBoard);
    if (currentWinner) {
      setWinner(currentWinner);
      setXIsNext(true); // Ensure player 'X' starts next game
      setIsAiTurn(false);
    } else {
      // If no winner, it's AI's turn
      setXIsNext(false);
      setIsAiTurn(true); // Signal that AI should make a move via useEffect
    }
  };

  // Function to reset the game
  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setXIsNext(true); // Player 'X' starts
    setWinner(null);
    setIsAiTurn(false);
    setError(null); // Clear errors on reset
    // Score persists across games
  };

  // Determine game status message
  let status;
  if (error) {
    status = `Error: ${error}`;
  } else if (winner) {
    status = winner === 'Draw' ? 'It\'s a Draw!' : `Winner: ${winner}`;
  } else {
    status = `Next player: ${xIsNext ? 'X' : 'O'}`;
  }

  // --- Modify Difficulty Indicator and Display ---
  let difficultyIndicator = "Learning...";
  let efficacyIndicator = ""; // New variable for initial state value interpretation
  if (aiStatus) {
    // Epsilon-based difficulty
    if (aiStatus.epsilon < 0.15) {
      difficultyIndicator = "Hard";
    } else if (aiStatus.epsilon < 0.5) {
      difficultyIndicator = "Medium";
    } else {
      difficultyIndicator = "Easy";
    }

    // Initial State Value interpretation (efficacy)
    const value = aiStatus.initial_state_value;
    if (value > 0.7) {
        efficacyIndicator = "Predicts Win";
    } else if (value > 0.3) {
        efficacyIndicator = "Predicts Draw";
    } else if (value > -0.5) {
        efficacyIndicator = "Predicts Loss Likely";
    } else {
        efficacyIndicator = "Predicts Loss";
    }
    efficacyIndicator += ` (V₀=${value.toFixed(3)})`; // Add raw value
  }


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-4xl font-bold mb-8">Tic-my-Toe</h1>

      {/* Game Status */}
      <div className={`mb-1 text-xl h-6 ${error ? 'text-red-500' : ''}`}> {/* Adjusted margin */}
        {status}
        {!error && !winner && isAiTurn && <span> (AI thinking...)</span>}
      </div>
       {/* AI Status Display */}
       <div className="mb-4 text-sm text-gray-500 h-5 flex flex-wrap justify-center gap-x-4">
         <span>{aiStatus ? `Difficulty: ${difficultyIndicator} (ε: ${aiStatus.epsilon.toFixed(3)})` : 'Fetching AI status...'}</span>
         {aiStatus && <span>|</span>}
         {aiStatus && <span>Efficacy: {efficacyIndicator}</span>}
         {aiStatus && <span>|</span>}
         {aiStatus && <span>States: {aiStatus.q_table_size}</span>}
       </div>


      {/* Game Board */}
      <div className="grid grid-cols-3 gap-2 w-64 h-64 border-2 border-foreground">
        {board.map((cell: string | null, index: number) => (
          <button
            key={index}
            className="flex items-center justify-center border border-foreground text-4xl font-bold hover:bg-foreground/10 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleCellClick(index)}
            // Disable button if cell is filled, game over, or it's AI's turn
            disabled={!!cell || !!winner || !xIsNext || isAiTurn} // Added isAiTurn check
          >
            {cell || '\u00A0'} {/* Render non-breaking space if cell is null */}
          </button>
        ))}
      </div>

       {/* Reset Button */}
       {(winner || error) && ( // Show reset button also on error
         <button
           onClick={resetGame}
           className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
         >
           {error ? 'Reset Game' : 'Play Again?'}
         </button>
       )}

      {/* Win Rate Counter */}
      <div className="mt-8 text-center">
        <h2 className="text-2xl mb-2">Score</h2>
        <p>Wins: {score.wins} | Draws: {score.draws} | Losses: {score.losses}</p>
      </div>
    </main>
  );
}
