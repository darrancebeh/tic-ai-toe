'use client';

import { useState, useEffect, useCallback, useRef } from 'react'; // Add useRef
import { FiGithub, FiLinkedin, FiTwitter, FiMail } from 'react-icons/fi';

// --- Define type for winner result ---
interface WinnerInfo {
  winner: 'X' | 'O' | 'Draw' | null;
  line: number[] | null;
}

// Helper function to calculate the winner and the winning line
function calculateWinner(squares: (string | null)[]): WinnerInfo {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a] as 'X' | 'O', line: lines[i] }; // Return winner and line
    }
  }
  // Check for draw (if no winner and board is full)
  if (squares.every(square => square !== null)) {
    return { winner: 'Draw', line: null };
  }
  return { winner: null, line: null }; // No winner yet
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
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo>({ winner: null, line: null }); // Store winner and line
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X'); // Player 'X' starts the very first game
  const [gameStarted, setGameStarted] = useState<boolean>(false); // Track if the game has started
  const [nextStarter, setNextStarter] = useState<'X' | 'O'>('O'); // AI ('O') will start the *next* game after the initial one

  // --- Player vs AI Score ---
  const [score, setScore] = useState({ wins: 0, draws: 0, losses: 0 });

  // --- UI & Interaction State ---
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false); // General thinking/loading indicator
  const [isBatchTraining, setIsBatchTraining] = useState<boolean>(false); // State for batch training loading
  const [isVisualizingBatch, setIsVisualizingBatch] = useState<boolean>(false); // State for visual simulation
  const [visualBoard, setVisualBoard] = useState<(string | null)[]>(Array(9).fill(null)); // Board for visualization
  const visualSimulationIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID

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

  // --- Reset AI Learning ---
  const resetAI = useCallback(async () => {
    if (!window.confirm("Are you sure you want to reset the AI's learning? This will delete all its learned knowledge.")) {
      return; // User cancelled
    }
    
    setError(null);
    try {
      setIsThinking(true); // Show loading state
      const response = await fetch(`${API_URL}/ai/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Reset Error: ${errorData.detail || response.statusText}`);
      }
      
      const updatedStatus: AIStatus = await response.json();
      setAiStatus(updatedStatus); // Update with reset AI status
      
      // Reset the game and scores when AI is reset
      setBoard(Array(9).fill(null));
      setWinnerInfo({ winner: null, line: null });
      setScore({ wins: 0, draws: 0, losses: 0 });
      setCurrentPlayer('X');
      setGameStarted(false);
      setNextStarter('O');
      setSelfPlayStats({ xWins: 0, oWins: 0, draws: 0, total: 0 });
      
    } catch (err) {
      console.error("Failed to reset AI:", err);
      setError(err instanceof Error ? err.message : "Failed to reset AI learning.");
    } finally {
      setIsThinking(false);
    }
  }, []);

  // --- Visual Simulation Logic ---
  const runVisualSimulationStep = useCallback(() => {
    setVisualBoard(prevBoard => {
      let currentBoard = [...prevBoard];
      let winnerInfo = calculateWinner(currentBoard); // Use existing winner logic

      // If game over on visual board, reset for next visual game
      if (winnerInfo.winner) {
        return Array(9).fill(null);
      }

      // Determine next player visually (simple alternation)
      const xCount = currentBoard.filter(c => c === 'X').length;
      const oCount = currentBoard.filter(c => c === 'O').length;
      const nextPlayer = xCount <= oCount ? 'X' : 'O';

      // Find available spots
      const availableSpots = currentBoard
        .map((val, idx) => (val === null ? idx : null))
        .filter(val => val !== null) as number[];

      if (availableSpots.length > 0) {
        // Choose a random available spot
        const randomSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
        currentBoard[randomSpot] = nextPlayer;
      }

      return currentBoard;
    });
  }, []);

  // --- Start/Stop Visual Simulation ---
  const startVisualSimulation = useCallback(() => {
    setIsVisualizingBatch(true);
    setVisualBoard(Array(9).fill(null)); // Start with empty board
    if (visualSimulationIntervalRef.current) {
      clearInterval(visualSimulationIntervalRef.current);
    }
    // Update visual board quickly
    visualSimulationIntervalRef.current = setInterval(runVisualSimulationStep, 100); // e.g., every 100ms
  }, [runVisualSimulationStep]);

  const stopVisualSimulation = useCallback(() => {
    setIsVisualizingBatch(false);
    if (visualSimulationIntervalRef.current) {
      clearInterval(visualSimulationIntervalRef.current);
      visualSimulationIntervalRef.current = null;
    }
  }, []);

  // --- Cleanup interval on unmount ---
  useEffect(() => {
    return () => {
      if (visualSimulationIntervalRef.current) {
        clearInterval(visualSimulationIntervalRef.current);
      }
    };
  }, []);

  // --- Modify Trigger Batch Training ---
  const triggerBatchTraining = useCallback(async (rounds: number = 1000) => {
    if (isBatchTraining) return; // Prevent multiple simultaneous requests

    console.log(`Triggering batch training for ${rounds} rounds...`);
    setIsBatchTraining(true); // Start loading indicator (keeps button disabled)
    startVisualSimulation(); // Start the visual simulation
    setError(null);

    try {
      const response = await fetch(`${API_URL}/ai/train_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_rounds: rounds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Batch Train Error: ${errorData.detail || response.statusText}`);
      }

      const updatedStatus: AIStatus = await response.json();
      setAiStatus(updatedStatus); // Update status with result from batch training
      console.log("Batch training completed successfully.");

    } catch (err) {
      console.error("Failed to trigger AI batch training:", err);
      setError(err instanceof Error ? err.message : "Failed during batch training.");
      // Fetch status even on error to see if anything changed partially
      await fetchAIStatus();
    } finally {
      setIsBatchTraining(false); // Stop loading indicator
      stopVisualSimulation(); // Stop the visual simulation
    }
  }, [fetchAIStatus, isBatchTraining, startVisualSimulation, stopVisualSimulation]); // Add simulation controls to dependencies

  // --- Effect to Check Winner & Handle Game End ---
  useEffect(() => {
    const currentWinnerInfo = calculateWinner(board);
    // Only trigger on new winner (when winnerInfo.winner was null but now isn't)
    if (currentWinnerInfo.winner && !winnerInfo.winner) {
      setWinnerInfo(currentWinnerInfo); // Set both winner and line
      setIsThinking(false); // Stop thinking indicator

      if (gameMode === 'playerVsAi') {
        // Update score only in Player vs AI mode
        setScore(prevScore => {
          if (currentWinnerInfo.winner === 'X') return { ...prevScore, wins: prevScore.wins + 1 };
          if (currentWinnerInfo.winner === 'O') return { ...prevScore, losses: prevScore.losses + 1 };
          if (currentWinnerInfo.winner === 'Draw') return { ...prevScore, draws: prevScore.draws + 1 };
          return prevScore;
        });
      }

      // Trigger learning regardless of mode (backend handles reward based on 'O')
      triggerLearning(board, currentWinnerInfo.winner);

      if (gameMode === 'selfPlay') {
        setSelfPlayState('gameOver'); // Mark self-play round as over
        setSelfPlayRounds(prev => prev + 1);
        // Update self-play stats <-- Update stats here
        setSelfPlayStats(prevStats => {
          const newTotal = prevStats.total + 1;
          let newXWins = prevStats.xWins;
          let newOWins = prevStats.oWins;
          let newDraws = prevStats.draws;
          if (currentWinnerInfo.winner === 'X') newXWins++;
          else if (currentWinnerInfo.winner === 'O') newOWins++;
          else if (currentWinnerInfo.winner === 'Draw') newDraws++;
          return { xWins: newXWins, oWins: newOWins, draws: newDraws, total: newTotal };
        });
      }
    }
  }, [board, winnerInfo.winner, gameMode, triggerLearning]); // Depend on winnerInfo.winner

  // --- Effect for AI Move (Player vs AI) ---
  useEffect(() => {
    // Use winnerInfo.winner to check game state
    // Trigger AI move if it's 'O's turn
    if (gameMode === 'playerVsAi' && currentPlayer === 'O' && !winnerInfo.winner && isThinking) {
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
             const currentWinnerCheck = calculateWinner(board); // Use updated function
             if (!currentWinnerCheck.winner) {
                 setError("AI error: Could not determine move.");
             }
          }
        } catch (err) {
          console.error("Failed to fetch AI move:", err);
          setError(err instanceof Error ? err.message : "Failed to connect to AI service.");
        } finally {
          // Only stop thinking if no winner yet (winner effect handles it otherwise)
          if (!calculateWinner(board).winner) { // Use updated function
              setIsThinking(false);
          }
        }
      };

      // Add delay for UX, slightly longer if AI starts to allow UI update
      const delay = board.every(cell => cell === null) ? 750 : 500; // Longer delay if board is empty (AI starting)
      const timer = setTimeout(fetchAiMove, delay);
      return () => clearTimeout(timer);
    }
    // Clear thinking state if it's Player's turn ('X') but thinking was somehow true
    else if (gameMode === 'playerVsAi' && currentPlayer === 'X' && isThinking) {
        setIsThinking(false);
    }
  }, [gameMode, currentPlayer, winnerInfo.winner, board, isThinking]); // Dependencies

  // --- Effect for AI Self-Play Loop ---
  useEffect(() => {
    // Use winnerInfo.winner to check game state
    if (gameMode === 'selfPlay' && selfPlayState === 'playing' && !winnerInfo.winner && isThinking) {
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
             const currentWinnerCheck = calculateWinner(board); // Use updated function
             if (!currentWinnerCheck.winner) {
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
  }, [gameMode, selfPlayState, currentPlayer, winnerInfo.winner, board, isThinking]); // Depend on winnerInfo.winner

  // --- Initial AI Status Fetch ---
  useEffect(() => {
    fetchAIStatus();
  }, [fetchAIStatus]); // Run once on mount

  // --- Handle Player Click ---
  const handleCellClick = (index: number) => {
    // Ignore click if not player's turn, cell filled, game over, thinking, or in self-play
    if (gameMode !== 'playerVsAi' || currentPlayer !== 'X' || board[index] || winnerInfo.winner || isThinking) {
      return;
    }

    // Mark game as started on first player move in PlayerVsAi mode
    if (!gameStarted && gameMode === 'playerVsAi') {
      setGameStarted(true);
    }

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setError(null);

    const currentWinnerCheck = calculateWinner(newBoard); // Use updated function
    if (!currentWinnerCheck.winner) {
      setCurrentPlayer('O'); // Switch to AI's turn
      setIsThinking(true); // Signal AI should think
    }
    // Winner check effect handles game end
  };

  // --- Reset Game Function ---
  const resetGame = (switchToPlayerVsAi = true) => {
    setBoard(Array(9).fill(null));
    setWinnerInfo({ winner: null, line: null }); // Reset winner info
    setError(null);
    setIsThinking(false); // Ensure thinking is false initially

    if (switchToPlayerVsAi) {
      setGameMode('playerVsAi');
      setSelfPlayState('idle');
      setSelfPlayRounds(0); // Reset self-play counter
      setSelfPlayStats({ xWins: 0, oWins: 0, draws: 0, total: 0 });
      setGameStarted(false); // Reset game started state for Player vs AI mode

      // --- Alternating Starter Logic ---
      setCurrentPlayer(nextStarter); // Set the starting player for this round
      const nextGameStarter = nextStarter === 'X' ? 'O' : 'X'; // Determine who starts the *next* round
      setNextStarter(nextGameStarter); // Update state for the next round

      // If AI ('O') is starting this round, set thinking to true to trigger its move
      if (nextStarter === 'O') {
        setIsThinking(true);
      }
      // --- End Alternating Starter Logic ---

    } else {
      // Resetting for another round of self-play
      setGameMode('selfPlay');
      setSelfPlayState('playing');
      setCurrentPlayer('X'); // Self-play always starts with 'X' for consistency
      setIsThinking(true); // Start the self-play loop again
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
  const winner = winnerInfo.winner; // Use the winner from winnerInfo
  const winningLine = winnerInfo.line; // Use the line from winnerInfo
  const isBoardEmpty = board.every(cell => cell === null); // Check if board is empty

  if (error) {
    status = <span className="text-red-500 font-semibold">Error: {error}</span>;
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
      if (winner === 'Draw') {
        status = <span className="font-bold text-yellow-500">It's a Draw!</span>;
      } else if (winner === 'X') {
        status = <span className="font-bold text-green-500">You Win! (X)</span>;
      } else { // winner === 'O'
        status = <span className="font-bold text-red-500">AI Wins! (O)</span>;
      }
    } else {
      // Clearer turn indicator, with special message if AI starts
      if (currentPlayer === 'O' && isBoardEmpty) {
        status = (
          <span>
            AI starts this round (O)
          </span>
        );
      } else {
        status = (
          <span>
            {currentPlayer === 'X' ? 'Your Turn (X)' : "AI's Turn (O)"}
          </span>
        );
      }
    }
  }
  // Add thinking indicator (will append to the status set above)
  if (isThinking && !winner && !error) {
     status = <span>{status} <span className="italic text-gray-400">(Thinking...)</span></span>;
  }


  // --- AI Status Indicators ---
  let difficultyIndicator = "Difficulty: Learning...";
  let knowledgeIndicator = "Knowledge Score: Learning...";
  let learningRateIndicator = "Learning Rate: Learning...";
  let aiStrengthDescription = "Assessing AI capabilities..."; // Placeholder text

  if (aiStatus) {
    // Difficulty (Epsilon)
    if (aiStatus.epsilon < 0.15) {
        difficultyIndicator = "Difficulty: Hard";
        aiStrengthDescription = "AI is highly optimized. Prepare for a tough match!";
    } else if (aiStatus.epsilon < 0.5) {
        difficultyIndicator = "Difficulty: Medium";
        aiStrengthDescription = "AI offers a balanced challenge.";
    } else {
        difficultyIndicator = "Difficulty: Easy";
        aiStrengthDescription = "AI is actively exploring and learning.";
    }
    difficultyIndicator += ` (ε: ${aiStatus.epsilon.toFixed(3)})`;

    // Knowledge Score (Q-Table Size)
    const MAX_EXPECTED_STATES = 5478;
    const qSize = aiStatus.q_table_size;
    const knowledgeScore = Math.min(100, Math.round((qSize / MAX_EXPECTED_STATES) * 100));
    knowledgeIndicator = `Knowledge Score: ${knowledgeScore}`;

    // Learning Rate (Avg Q Change)
    if (aiStatus.avg_q_change !== null) {
      const avgChange = aiStatus.avg_q_change;
      const formattedChange = avgChange < 0.0001 && avgChange !== 0
                              ? avgChange.toExponential(2)
                              : avgChange.toFixed(5);
      learningRateIndicator = `Learning Rate: ${formattedChange}`;
    } else {
      learningRateIndicator = "Learning Rate: N/A";
    }

  } else if (!error) {
     difficultyIndicator = 'Difficulty: Fetching...';
     knowledgeIndicator = 'Knowledge Score: Fetching...';
     learningRateIndicator = 'Learning Rate: Fetching...';
     // aiStrengthDescription remains "Assessing AI capabilities..."
  }

  const currentYear = new Date().getFullYear();

  // --- Calculate Self-Play Percentages ---
  const xWinPercent = selfPlayStats.total > 0 ? ((selfPlayStats.xWins / selfPlayStats.total) * 100).toFixed(1) : '0.0';
  const oWinPercent = selfPlayStats.total > 0 ? ((selfPlayStats.oWins / selfPlayStats.total) * 100).toFixed(1) : '0.0';
  const drawPercent = selfPlayStats.total > 0 ? ((selfPlayStats.draws / selfPlayStats.total) * 100).toFixed(1) : '0.0';

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="flex flex-col items-center justify-center flex-grow w-full max-w-md">
        <h1 className="text-4xl font-bold mb-4">Tic-my-Toe</h1>

        {/* Game Status */}
        <div className={`mb-1 text-xl h-8 flex items-center justify-center text-center`}> {/* Increased height slightly */}
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

        {/* AI Strength Description */}
        {!isVisualizingBatch && (
          <p className="mb-4 text-sm text-center text-gray-400 italic h-auto min-h-[1.5rem]">
            {aiStrengthDescription}
          </p>
        )}

         {/* Game Board Area */}
         <div className={`w-64 h-64 mb-6 relative`}>
           {/* Show Visual Simulation OR Actual Game Board */}
           {isVisualizingBatch ? (
             // Visual Simulation Board
             <div className="grid grid-cols-3 gap-2 w-full h-full border-2 border-purple-500 animate-pulse">
               {visualBoard.map((cell, index) => (
                 <div
                   key={`vis-${index}`}
                   className={`w-full h-full flex items-center justify-center border border-purple-400/50 text-4xl font-bold
                               ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-red-400' : ''}`}
                 >
                   {cell || <>&nbsp;</>}
                 </div>
               ))}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30">
                   <p className="text-white text-lg font-semibold bg-purple-600/80 px-3 py-1 rounded">Visualizing Training...</p>
               </div>
             </div>
           ) : (
             // Actual Game Board
             <div className={`grid grid-cols-3 gap-2 w-full h-full border-2 border-foreground
                          ${winner === 'Draw' ? 'bg-yellow-500/30 border-yellow-500' : ''}
                          ${winner && winner !== 'Draw' ? 'opacity-70' : ''} // Dim board slightly on win/loss
                          `}>
               {board.map((cell: string | null, index: number) => {
                 const isWinningCell = winningLine?.includes(index) ?? false;
                 const highlightClass = winner === 'X' ? 'bg-green-500/50' : winner === 'O' ? 'bg-red-500/50' : '';
                 return (
                   <button
                     key={index}
                     className={`w-full h-full flex items-center justify-center border border-foreground text-4xl font-bold
                                 hover:bg-foreground/10 transition-colors duration-150
                                 ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-red-400' : ''}
                                 ${isWinningCell ? highlightClass : ''}
                                 disabled:opacity-60 disabled:cursor-not-allowed`}
                     onClick={() => handleCellClick(index)}
                     disabled={!!cell || !!winner || isThinking || (gameMode === 'playerVsAi' && currentPlayer !== 'X') || gameMode === 'selfPlay'}
                   >
                     {cell || <>&nbsp;</>}
                   </button>
                 );
               })}
               {/* Conclusion Overlay */}
               {winner && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <span className={`text-5xl font-extrabold px-4 py-2 rounded shadow-lg
                                    ${winner === 'Draw' ? 'text-yellow-900 bg-yellow-400/80' : ''}
                                    ${winner === 'X' ? 'text-green-900 bg-green-400/80' : ''}
                                    ${winner === 'O' ? 'text-red-900 bg-red-400/80' : ''}
                                   `}>
                     {winner === 'Draw' ? 'DRAW' : `${winner} WINS!`}
                   </span>
                 </div>
               )}
             </div>
           )}
         </div>

         {/* --- Main Action Buttons (Train/Self-Play) --- */}
         {!isVisualizingBatch && (
           <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
             {/* Batch Training Button */}
             <button
               onClick={() => triggerBatchTraining(1000)} // Example: 1000 rounds
               disabled={isBatchTraining || selfPlayState === 'playing'} // Disable if training or self-playing
               className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
             >
               {isBatchTraining ? 'Training...' : 'Run Batch Training'}
             </button>

             {/* Self-Play Button */}
             <button
               onClick={startSelfPlay}
               disabled={isBatchTraining || selfPlayState === 'playing'} // Disable if batch training or self-playing
               className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
             >
              {selfPlayState === 'playing' || selfPlayState === 'gameOver' ? 'Continue Self-Training' : 'Start AI Self-Play'}
             </button>
             
             {/* Reset AI Button */}
             <button
               onClick={resetAI}
               disabled={isBatchTraining || selfPlayState === 'playing' || isThinking} // Disable if AI is busy
               className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
             >
               Reset AI Learning
             </button>
           </div>
         )}

         {/* Control Buttons Container */}
         <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-center"> {/* Increased margin-top */}
           {/* --- Player vs AI Reset Button --- */}
           {gameMode === 'playerVsAi' && winnerInfo.winner && (
             <button
               onClick={() => resetGame(false)} // Keep playerVsAi mode
               className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors w-full sm:w-auto" // Full width on small screens
             >
               Play Again
             </button>
           )}

           {/* --- Self-Play Mode Controls --- */}
           {gameMode === 'selfPlay' && selfPlayState === 'gameOver' && (
             <>
               <button
                 onClick={() => resetGame(true)} // Switch to player vs AI
                 className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors w-full sm:w-auto" // Full width on small screens
               >
                 Play vs AI Now
               </button>
             </>
           )}
         </div> {/* End Control Buttons Container */}

      </div> {/* End Main Content Container */}

      {/* Footer */}
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
