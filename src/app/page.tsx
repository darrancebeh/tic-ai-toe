'use client';

import { useState, useEffect, useCallback, useRef } from 'react'; // Add useRef
import { FiGithub, FiLinkedin, FiTwitter, FiMail, FiInfo } from 'react-icons/fi'; // Add FiInfo icon

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

// --- AI Metrics Guide Component ---
interface AIMetricsGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

function AIMetricsGuide({ isOpen, onClose }: AIMetricsGuideProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Understanding AI Metrics</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        
        <div className="p-6">
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-purple-400">AI Difficulty Scale</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Difficulty</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Epsilon (ε)</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Description</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Win Chance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="p-3 text-green-400 font-medium">Beginner</td>
                    <td className="p-3">0.7 - 0.9</td>
                    <td className="p-3 text-sm">AI is mostly exploring random moves and building a basic understanding of the game. Player victory is very likely.</td>
                    <td className="p-3">70-90% with strategic play</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3 text-blue-400 font-medium">Intermediate</td>
                    <td className="p-3">0.5 - 0.7</td>
                    <td className="p-3 text-sm">AI balances exploration with some strategy it adapted and recognizes some basic patterns. Player victory is still very likely.</td>
                    <td className="p-3">50-70% for experienced players</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3 text-yellow-400 font-medium">Advanced</td>
                    <td className="p-3">0.3 - 0.5</td>
                    <td className="p-3 text-sm">AI has adapted to only make occasional errors and will capitalize on player mistakes. Player victory can still be likely with best moves.</td>
                    <td className="p-3">30-50% even with good strategy</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3 text-orange-400 font-medium">Expert</td>
                    <td className="p-3">0.15 - 0.3</td>
                    <td className="p-3 text-sm">AI has mastered most possible patterns and rarely makes errors with nearly optimal moves. Player victory is unlikely now, with draws being the common outcome.</td>
                    <td className="p-3">10-20% for very skilled players</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-red-400 font-medium">The Great Toe</td>
                    <td className="p-3">&lt; 0.15</td>
                    <td className="p-3 text-sm">AI now plays practically perfect Tic-tac-toe. For a simple game like Tic-tac-toe, this approaches unbeatable play. Player victory is practically impossible. Best moves must be consistently made to secure a draw.</td>
                    <td className="p-3">0-5% (draws are the best outcome)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-400 italic">Note: Lower epsilon (ε) values mean the AI relies more on learned strategy rather than random exploration.</p>
          </section>
          
          <section className="mb-8">
            <h3 className="text-lg font-semibold mb-3 text-purple-400">Knowledge Score</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Score Range</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Q-Table Size</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">0-20</td>
                    <td className="p-3">0-1,100 states</td>
                    <td className="p-3 text-sm">AI has minimal knowledge of the game and patterns, and has encountered only a small fraction of possible board states.</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">21-40</td>
                    <td className="p-3">1,101-2,200 states</td>
                    <td className="p-3 text-sm">AI has developed some basic understanding of common positions now, but still lacking any strategic depth.</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">41-60</td>
                    <td className="p-3">2,201-3,300 states</td>
                    <td className="p-3 text-sm">AI now has moderate experience across many different board states and understands basic winning patterns.</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">61-80</td>
                    <td className="p-3">3,301-4,400 states</td>
                    <td className="p-3 text-sm">AI has extensive knowledge of most common game variations and has developed strong patterns and strategies. AI playing best moves is now the norm.</td>
                  </tr>
                  <tr>
                    <td className="p-3">81-100</td>
                    <td className="p-3">4,401-5,478+ states</td>
                    <td className="p-3 text-sm">AI has comprehensive knowledge of virtually all possible game states. At this level, all AI moves are practically the best possible moves.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-400 italic">Note: Tic-tac-toe has 5,478 possible unique board states when accounting for symmetry. The AI becomes stronger as it learns more states.</p>
          </section>
          
          <section className="mb-4">
            <h3 className="text-lg font-semibold mb-3 text-purple-400">Learning Rate</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Avg. Q Change</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Learning Stage</th>
                    <th className="p-3 text-left text-sm font-medium text-gray-300 border-b border-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">≥ 0.1</td>
                    <td className="p-3">Rapid Learning</td>
                    <td className="p-3 text-sm">AI is making major adjustments to its strategy and exploring patterns and board moves.</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">0.01 - 0.099</td>
                    <td className="p-3">Active Learning</td>
                    <td className="p-3 text-sm">AI is starting to refine its understanding of different positions.</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="p-3">0.001 - 0.009</td>
                    <td className="p-3">Fine Tuning</td>
                    <td className="p-3 text-sm">AI is making small adjustments and optimizing its play in its strategy.</td>
                  </tr>
                  <tr>
                    <td className="p-3">&lt; 0.001</td>
                    <td className="p-3">Converging</td>
                    <td className="p-3 text-sm">AI's strategy is stabilizing as it approaches practically optimal play. Extremely small adjustments indicate the AI has practically mastered the game.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-400 italic">Note: As learning rate approaches zero, the AI has essentially "solved" the game and further training produces diminishing returns.</p>
          </section>

          <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h4 className="font-semibold text-yellow-400 mb-2 flex items-center gap-2">
              <FiInfo size={18} /> Important Note on Tic-Tac-Toe Difficulty
            </h4>
            <p className="text-sm text-gray-300">
              Tic-tac-toe is a "solved game" with perfect play. With sufficient training, an AI can learn the perfect strategy that guarantees at least a draw against any opponent.
            </p>
            <p className="text-sm text-gray-300 mt-2">
              At the highest difficulty level (The Great Toe), the AI has essentially solved the game and becomes virtually unbeatable. The best possible outcome for a human player against a fully trained AI is a draw, which even then requires perfect play with all best moves. Any mistake against an optimal AI will result in a loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [showMetricsGuide, setShowMetricsGuide] = useState<boolean>(false); // State for metrics guide modal

  // --- States for Batch Training Visualization ---
  const [isBatchTraining, setIsBatchTraining] = useState<boolean>(false); // State for batch training loading
  const [isVisualizingBatch, setIsVisualizingBatch] = useState<boolean>(false); // State for visual simulation
  const [visualBoard, setVisualBoard] = useState<(string | null)[]>(Array(9).fill(null)); // Board for visualization
  const visualSimulationIntervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID
  const [trainingProgress, setTrainingProgress] = useState({ current: 0, total: 0, completed: 0 }); // Training progress tracker

  // --- AI Status ---
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  // --- Game Mode & Self-Play State --- REMOVED self-play states

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
        
        // Make only ONE move per simulation step for clearer visibility
        currentBoard[randomSpot] = nextPlayer;
        
        // Sometimes make strategic moves for more realistic visualization
        if (Math.random() > 0.6) {
          // Check if there's a winning move for either player
          for (let i = 0; i < availableSpots.length; i++) {
            const testSpot = availableSpots[i];
            if (testSpot !== randomSpot) { // Don't check the spot we already filled
              const testBoard = [...currentBoard];
              testBoard[testSpot] = nextPlayer;
              const testWinner = calculateWinner(testBoard);
              if (testWinner.winner === nextPlayer) {
                // Found a winning move, use it instead
                currentBoard[randomSpot] = null; // Undo the random move
                currentBoard[testSpot] = nextPlayer; // Make the winning move
                break;
              }
            }
          }
        }
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
    // Much slower animation speed (250ms) to make moves clearly visible
    visualSimulationIntervalRef.current = setInterval(runVisualSimulationStep, 250); // Changed from 50ms to 250ms
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
    
    // Initialize training progress for visualization
    setTrainingProgress({ current: 0, total: rounds, completed: 0 });
    
    startVisualSimulation(); // Start the visual simulation
    setError(null);

    // Define the simulation step size to update the counter
    const stepSize = Math.max(1, Math.floor(rounds / 50)); // Update roughly 50 times during training
    
    try {
      const startTime = Date.now(); // Track when we started
      const response = await fetch(`${API_URL}/ai/train_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_rounds: rounds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Batch Train Error: ${errorData.detail || response.statusText}`);
      }

      // Simulate progress updates while waiting for response
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += stepSize;
        if (progress >= rounds) {
          clearInterval(progressInterval);
          progress = rounds;
        }
        setTrainingProgress(prev => ({
          ...prev,
          current: progress,
          completed: Math.floor((progress / rounds) * 100)
        }));
      }, 50); // Update every 50ms to match the visualization speed

      const updatedStatus: AIStatus = await response.json();
      
      // Clean up the progress interval when we get response
      clearInterval(progressInterval);
      
      // Set the final progress to 100%
      setTrainingProgress(prev => ({ ...prev, current: rounds, completed: 100 }));
      
      setAiStatus(updatedStatus); // Update status with result from batch training
      console.log(`Batch training completed successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    } catch (err) {
      console.error("Failed to trigger AI batch training:", err);
      setError(err instanceof Error ? err.message : "Failed during batch training.");
      // Fetch status even on error to see if anything changed partially
      await fetchAIStatus();
    } finally {
      // Keep the visualization running for a brief moment to show completion
      setTimeout(() => {
        setIsBatchTraining(false); // Stop loading indicator
        stopVisualSimulation(); // Stop the visual simulation
      }, 1000); // Allow users to see the completed state for 1 second
    }
  }, [fetchAIStatus, isBatchTraining, startVisualSimulation, stopVisualSimulation]); // Add simulation controls to dependencies

  // --- Effect to Check Winner & Handle Game End ---
  useEffect(() => {
    const currentWinnerInfo = calculateWinner(board);
    // Only trigger on new winner (when winnerInfo.winner was null but now isn't)
    if (currentWinnerInfo.winner && !winnerInfo.winner) {
      setWinnerInfo(currentWinnerInfo); // Set both winner and line
      setIsThinking(false); // Stop thinking indicator

      // Update score only in Player vs AI mode (now the only mode)
      setScore(prevScore => {
        if (currentWinnerInfo.winner === 'X') return { ...prevScore, wins: prevScore.wins + 1 };
        if (currentWinnerInfo.winner === 'O') return { ...prevScore, losses: prevScore.losses + 1 };
        if (currentWinnerInfo.winner === 'Draw') return { ...prevScore, draws: prevScore.draws + 1 };
        return prevScore;
      });

      // Trigger learning regardless of mode (backend handles reward based on 'O')
      triggerLearning(board, currentWinnerInfo.winner);
    }
  }, [board, winnerInfo.winner, triggerLearning]); // REMOVED gameMode from dependencies

  // --- Effect for AI Move (Player vs AI) ---
  useEffect(() => {
    // Use winnerInfo.winner to check game state
    // Trigger AI move if it's 'O's turn
    if (currentPlayer === 'O' && !winnerInfo.winner && isThinking) { // REMOVED gameMode check
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
    else if (currentPlayer === 'X' && isThinking) { // REMOVED gameMode check
        setIsThinking(false);
    }
  }, [currentPlayer, winnerInfo.winner, board, isThinking]); // REMOVED gameMode from dependencies

  // --- Initial AI Status Fetch ---
  useEffect(() => {
    fetchAIStatus();
  }, [fetchAIStatus]); // Run once on mount

  // --- Handle Player Click ---
  const handleCellClick = (index: number) => {
    // Ignore click if not player's turn, cell filled, game over, or thinking
    if (currentPlayer !== 'X' || board[index] || winnerInfo.winner || isThinking) { // REMOVED gameMode checks
      return;
    }

    // Mark game as started on first player move
    if (!gameStarted) { // REMOVED gameMode check
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
  const resetGame = () => { // REMOVED switchToPlayerVsAi parameter
    setBoard(Array(9).fill(null));
    setWinnerInfo({ winner: null, line: null }); // Reset winner info
    setError(null);
    setIsThinking(false); // Ensure thinking is false initially

    // Always reset to Player vs AI mode (the only mode now)
    // REMOVED gameMode setting
    // --- Alternating Starter Logic ---
    setCurrentPlayer(nextStarter); // Set the starting player for this round
    const nextGameStarter = nextStarter === 'X' ? 'O' : 'X'; // Determine who starts the *next* round
    setNextStarter(nextGameStarter); // Update state for the next round

    // If AI ('O') is starting this round, set thinking to true to trigger its move
    if (nextStarter === 'O') {
      setIsThinking(true);
    }
    // --- End Alternating Starter Logic ---

    // Score persists across playerVsAi games
    // Fetch status on reset to show latest AI state
    fetchAIStatus();
  };

  // --- Determine Game Status Message ---
  let status;
  const winner = winnerInfo.winner; // Use the winner from winnerInfo
  const winningLine = winnerInfo.line; // Use the line from winnerInfo
  const isBoardEmpty = board.every(cell => cell === null); // Check if board is empty

  if (error) {
    status = <span className="text-red-500 font-semibold">Error: {error}</span>;
  } else { // Player vs AI mode (only mode)
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
             {/* Metrics Guide Button */}
             <div className="flex items-center justify-center mb-1">
               <button 
                 className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                 onClick={() => setShowMetricsGuide(true)}
               >
                 <FiInfo size={14} /> Understanding our Toe AI Metrics
               </button>
             </div>
             {/* Display Difficulty (Epsilon) */}
             <div>{difficultyIndicator}</div>
             {/* Display Knowledge Score */}
             <div>{knowledgeIndicator}</div>
             {/* Display Learning Rate (Avg Q Change) */}
             <div>{learningRateIndicator}</div>
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
                               transition-all duration-300 ease-in-out
                               ${cell === 'X' ? 'text-blue-400 bg-blue-900/20 animate-fadeIn' : 
                                 cell === 'O' ? 'text-red-400 bg-red-900/20 animate-fadeIn' : ''}`}
                 >
                   {cell || <>&nbsp;</>}
                 </div>
               ))}
               <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-black/40">
                   <p className="text-white text-lg font-semibold bg-purple-600/90 px-4 py-2 rounded-md shadow-lg animate-pulse">
                    Training AI...
                   </p>
                   {isBatchTraining && (
                     <div className="flex flex-col items-center bg-black/60 px-6 py-3 rounded-md">
                       <div className="w-48 h-3 bg-gray-700 rounded-full overflow-hidden mb-1">
                         <div 
                           className="h-full bg-purple-400 transition-all duration-150 shadow-glow" 
                           style={{ width: `${trainingProgress.completed}%` }}
                         />
                       </div>
                       <p className="text-white text-sm">
                         <span className="font-mono">{trainingProgress.current.toLocaleString()}</span> / 
                         <span className="font-mono"> {trainingProgress.total.toLocaleString()}</span> games
                         {trainingProgress.completed > 0 && 
                          <span className="ml-1 font-semibold text-purple-300">
                            ({trainingProgress.completed}%)
                          </span>
                         }
                       </p>
                     </div>
                   )}
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
                     disabled={!!cell || !!winner || isThinking || currentPlayer !== 'X'} // Simplified disabled condition
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
           <div className="mb-2 flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
             {/* Batch Training Button */}
             <button
               onClick={() => triggerBatchTraining(1000)} // Example: 1000 rounds
               disabled={isBatchTraining || isThinking} // Simplified disabled condition
               className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
             >
               {isBatchTraining ? 'Training...' : 'Run Batch Training'}
             </button>

             {/* Reset AI Button */}
             <button
               onClick={resetAI}
               disabled={isBatchTraining || isThinking} // Simplified disabled condition
               className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
             >
               Reset AI Learning
             </button>
           </div>
         )}
         
         {/* Batch Training Disclaimer */}
         {!isVisualizingBatch && (
           <div className="mb-6 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-200 text-center max-w-md">
             <strong>⚠️ Warning:</strong> Batch training simulates thousands of AI self-trained games (The AI will play against itself repeatedly for 1000 games). After training, 
             the AI will become significantly refined and may be almost significantly tougher to beat as it drastically optimizes its strategy.
           </div>
         )}

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

      {/* AI Metrics Guide Modal */}
      <AIMetricsGuide 
        isOpen={showMetricsGuide} 
        onClose={() => setShowMetricsGuide(false)} 
      />
    </main>
  );
}
