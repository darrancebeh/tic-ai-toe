'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiGithub, FiLinkedin, FiTwitter, FiMail, FiInfo, FiLoader, FiRotateCcw } from 'react-icons/fi';

interface WinnerInfo {
  winner: 'X' | 'O' | 'Draw' | null;
  line: number[] | null;
}

function calculateWinner(squares: (string | null)[]): WinnerInfo {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a] as 'X' | 'O', line: lines[i] };
    }
  }
  if (squares.every(square => square !== null)) {
    return { winner: 'Draw', line: null };
  }
  return { winner: null, line: null };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface AIStatus {
  epsilon: number;
  q_table_size: number;
  initial_state_value: number;
  avg_q_change: number | null;
}

interface AIMetricsGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

function AIMetricsGuide({ isOpen, onClose }: AIMetricsGuideProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Understanding AI Metrics</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-3xl font-bold p-2 -m-2"
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

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full p-6">
        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo>({ winner: null, line: null });
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [nextStarter, setNextStarter] = useState<'X' | 'O'>('O');

  const [score, setScore] = useState({ wins: 0, draws: 0, losses: 0 });

  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [showMetricsGuide, setShowMetricsGuide] = useState<boolean>(false);
  const [isResettingAI, setIsResettingAI] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmModalProps, setConfirmModalProps] = useState<Omit<ConfirmModalProps, 'isOpen'>>({
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const [isBatchTraining, setIsBatchTraining] = useState<boolean>(false);
  const [isVisualizingBatch, setIsVisualizingBatch] = useState<boolean>(false);
  const [visualBoard, setVisualBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const visualSimulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [trainingProgress, setTrainingProgress] = useState({ current: 0, total: 0, completed: 0 });

  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  const fetchAIStatus = useCallback(async () => {
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
      setAiStatus(null);
    }
  }, []);

  const triggerLearning = useCallback(async (finalBoard: (string | null)[], gameWinner: string) => {
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
      await fetchAIStatus();
    } catch (err) {
      console.error("Failed to trigger AI learning:", err);
    }
  }, [fetchAIStatus]);

  const resetAI = useCallback(async () => {
    setConfirmModalProps({
      title: "Reset AI Learning?",
      message: "Are you sure you want to reset the AI's learning? This will delete all its learned knowledge and reset scores.",
      confirmText: "Reset AI",
      onConfirm: async () => {
        setShowConfirmModal(false);
        setError(null);
        setIsResettingAI(true);
        setIsThinking(true);
        try {
          const response = await fetch(`${API_URL}/ai/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Reset Error: ${errorData.detail || response.statusText}`);
          }
          
          const updatedStatus: AIStatus = await response.json();
          setAiStatus(updatedStatus);
          
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
          setIsResettingAI(false);
          setIsThinking(false);
        }
      },
      onCancel: () => {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);

  }, []);

  const runVisualSimulationStep = useCallback(() => {
    setVisualBoard(prevBoard => {
      let currentBoard = [...prevBoard];
      let winnerInfo = calculateWinner(currentBoard);

      if (winnerInfo.winner) {
        return Array(9).fill(null);
      }

      const xCount = currentBoard.filter(c => c === 'X').length;
      const oCount = currentBoard.filter(c => c === 'O').length;
      const nextPlayer = xCount <= oCount ? 'X' : 'O';

      const availableSpots = currentBoard
        .map((val, idx) => (val === null ? idx : null))
        .filter(val => val !== null) as number[];

      if (availableSpots.length > 0) {
        const randomSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
        currentBoard[randomSpot] = nextPlayer;
        
        if (Math.random() > 0.6) {
          for (let i = 0; i < availableSpots.length; i++) {
            const testSpot = availableSpots[i];
            if (testSpot !== randomSpot) {
              const testBoard = [...currentBoard];
              testBoard[testSpot] = nextPlayer;
              const testWinner = calculateWinner(testBoard);
              if (testWinner.winner === nextPlayer) {
                currentBoard[randomSpot] = null;
                currentBoard[testSpot] = nextPlayer;
                break;
              }
            }
          }
        }
      }

      return currentBoard;
    });
  }, []);

  const startVisualSimulation = useCallback(() => {
    setIsVisualizingBatch(true);
    setVisualBoard(Array(9).fill(null));
    if (visualSimulationIntervalRef.current) {
      clearInterval(visualSimulationIntervalRef.current);
    }
    visualSimulationIntervalRef.current = setInterval(runVisualSimulationStep, 250);
  }, [runVisualSimulationStep]);

  const stopVisualSimulation = useCallback(() => {
    setIsVisualizingBatch(false);
    if (visualSimulationIntervalRef.current) {
      clearInterval(visualSimulationIntervalRef.current);
      visualSimulationIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (visualSimulationIntervalRef.current) {
        clearInterval(visualSimulationIntervalRef.current);
      }
    };
  }, []);

  const triggerBatchTraining = useCallback(async (rounds: number = 1000) => {
    if (isBatchTraining) return;

    console.log(`Triggering batch training for ${rounds} rounds...`);
    setIsBatchTraining(true);
    setTrainingProgress({ current: 0, total: rounds, completed: 0 });
    startVisualSimulation();
    setError(null);

    const stepSize = Math.max(1, Math.floor(rounds / 50));
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_URL}/ai/train_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_rounds: rounds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Batch Train Error: ${errorData.detail || response.statusText}`);
      }

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
      }, 50);

      const updatedStatus: AIStatus = await response.json();
      
      clearInterval(progressInterval);
      
      setTrainingProgress(prev => ({ ...prev, current: rounds, completed: 100 }));
      
      setAiStatus(updatedStatus);
      console.log(`Batch training completed successfully in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    } catch (err) {
      console.error("Failed to trigger AI batch training:", err);
      setError(err instanceof Error ? err.message : "Failed during batch training.");
      await fetchAIStatus();
    } finally {
      setTimeout(() => {
        setIsBatchTraining(false);
        stopVisualSimulation();
      }, 1000);
    }
  }, [fetchAIStatus, isBatchTraining, startVisualSimulation, stopVisualSimulation]);

  useEffect(() => {
    const currentWinnerInfo = calculateWinner(board);
    if (currentWinnerInfo.winner && !winnerInfo.winner) {
      setWinnerInfo(currentWinnerInfo);
      setIsThinking(false);

      setScore(prevScore => {
        if (currentWinnerInfo.winner === 'X') return { ...prevScore, wins: prevScore.wins + 1 };
        if (currentWinnerInfo.winner === 'O') return { ...prevScore, losses: prevScore.losses + 1 };
        if (currentWinnerInfo.winner === 'Draw') return { ...prevScore, draws: prevScore.draws + 1 };
        return prevScore;
      });

      triggerLearning(board, currentWinnerInfo.winner);
    }
  }, [board, winnerInfo.winner, triggerLearning]);

  useEffect(() => {
    if (currentPlayer === 'O' && !winnerInfo.winner && isThinking) {
      setError(null);
      const fetchAiMove = async () => {
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
            setBoard(newBoard);
            setCurrentPlayer('X');
          } else if (aiMoveIndex !== null) {
            console.error("AI returned invalid move index:", aiMoveIndex);
            setError("AI error: Invalid move received.");
          } else {
             console.warn("AI returned null move. Checking board state:", board);
             const currentWinnerCheck = calculateWinner(board);
             if (!currentWinnerCheck.winner) {
                 setError("AI error: Could not determine move.");
             }
          }
        } catch (err) {
          console.error("Failed to fetch AI move:", err);
          setError(err instanceof Error ? err.message : "Failed to connect to AI service.");
        } finally {
          if (!calculateWinner(board).winner) {
              setIsThinking(false);
          }
        }
      };

      const delay = board.every(cell => cell === null) ? 750 : 500;
      const timer = setTimeout(fetchAiMove, delay);
      return () => clearTimeout(timer);
    }
    else if (currentPlayer === 'X' && isThinking) {
        setIsThinking(false);
    }
  }, [currentPlayer, winnerInfo.winner, board, isThinking]);

  useEffect(() => {
    fetchAIStatus();
  }, [fetchAIStatus]);

  const handleCellClick = (index: number) => {
    if (currentPlayer !== 'X' || board[index] || winnerInfo.winner || isThinking) {
      return;
    }

    if (!gameStarted) {
      setGameStarted(true);
    }

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setError(null);

    const currentWinnerCheck = calculateWinner(newBoard);
    if (!currentWinnerCheck.winner) {
      setCurrentPlayer('O');
      setIsThinking(true);
    }
  };

  const resetGame = () => { 
    setBoard(Array(9).fill(null));
    setWinnerInfo({ winner: null, line: null }); 
    setError(null);
    setIsThinking(false); 

    setCurrentPlayer(nextStarter); 
    const nextGameStarter = nextStarter === 'X' ? 'O' : 'X'; 
    setNextStarter(nextGameStarter); 

    if (nextStarter === 'O') {
      setIsThinking(true);
    }
    setGameStarted(false);

    fetchAIStatus();
  };

  let status;
  const winner = winnerInfo.winner;
  const winningLine = winnerInfo.line;
  const isBoardEmpty = board.every(cell => cell === null);

  if (error) {
    status = <span className="text-red-500 font-semibold">Error: {error}</span>;
  } else {
    if (winner) {
      if (winner === 'Draw') {
        status = <span className="font-bold text-yellow-500">It's a Draw!</span>;
      } else if (winner === 'X') {
        status = <span className="font-bold text-green-500">You Win! (X)</span>;
      } else {
        status = <span className="font-bold text-red-500">AI Wins! (O)</span>;
      }
    } else {
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
  if (isThinking && !winner && !error) {
     status = <span>{status} <span className="italic text-gray-400">(Thinking...)</span></span>;
  }

  let difficultyIndicator = "Difficulty: Learning...";
  let knowledgeIndicator = "Knowledge Score: Learning...";
  let learningRateIndicator = "Learning Rate: Learning...";
  let aiStrengthDescription = "Assessing AI capabilities...";

  if (aiStatus) {
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

    const MAX_EXPECTED_STATES = 5478;
    const qSize = aiStatus.q_table_size;
    const knowledgeScore = Math.min(100, Math.round((qSize / MAX_EXPECTED_STATES) * 100));
    knowledgeIndicator = `Knowledge Score: ${knowledgeScore}`;

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
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between pt-8 px-8 font-[family-name:var(--font-geist-sans)]">
      <div className="flex flex-col items-center justify-center flex-grow w-full max-w-md">
        <h1 className="text-4xl font-bold mb-4">{'{db} Tic-my-Toe'}</h1>

        <div className={`mb-1 text-xl h-8 flex items-center justify-center text-center`}>
          {status}
        </div>

        <div className="mb-3 text-sm text-gray-400 flex gap-4 justify-center font-mono">
          <span>Wins: <span className="text-green-400 font-semibold">{score.wins}</span></span>
          <span>Draws: <span className="text-yellow-400 font-semibold">{score.draws}</span></span>
          <span>Losses: <span className="text-red-400 font-semibold">{score.losses}</span></span>
        </div>

         <div className="mb-4 text-sm text-gray-400 h-auto min-h-[4rem] flex flex-col items-center text-center gap-y-1">
             <div className="flex items-center justify-center mb-1">
               <button 
                 className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                 onClick={() => setShowMetricsGuide(true)}
               >
                 <FiInfo size={14} /> Understanding our Toe AI Metrics
               </button>
             </div>
             <div>{difficultyIndicator}</div>
             <div>{knowledgeIndicator}</div>
             <div>{learningRateIndicator}</div>
           </div>

        {!isVisualizingBatch && (
          <p className="mb-4 text-sm text-center text-gray-400 italic h-auto min-h-[1.5rem]">
            {aiStrengthDescription}
          </p>
        )}

         <div className={`w-64 h-64 mb-6 relative`}>
           {isVisualizingBatch ? (
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
               <div className="absolute inset-0 flex flex-col gap-3 items-center justify-center bg-black/60">
                   <p className="text-white text-xs font-semibold bg-black/70 px-2 py-1 rounded shadow">
                    Simulating AI Self-Training...
                   </p>
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
             <div className={`grid grid-cols-3 gap-2 w-full h-full border-2 border-foreground
                          ${winner === 'Draw' ? 'bg-yellow-500/30 border-yellow-500' : ''}
                          ${winner && winner !== 'Draw' ? 'opacity-70' : ''}
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
                     disabled={!!cell || !!winner || isThinking || currentPlayer !== 'X'}
                   >
                     {cell || <>&nbsp;</>}
                   </button>
                 );
               })}
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

         {!isVisualizingBatch && (
           <div className="mb-2 flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
             <button
               onClick={() => triggerBatchTraining(1000)}
               disabled={isBatchTraining || isThinking || isResettingAI}
               className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
             >
               {isBatchTraining ? (
                 <><FiLoader className="animate-spin" /> Training...</>
               ) : (
                 'Run Batch Training'
               )}
             </button>

             <button
               onClick={resetGame}
               disabled={!gameStarted || !!winnerInfo.winner || isThinking || isBatchTraining || isResettingAI}
               className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
             >
               <FiRotateCcw /> Reset Game
             </button>

             <button
               onClick={resetAI}
               disabled={isBatchTraining || isThinking || isResettingAI}
               className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
             >
               {isResettingAI ? (
                 <><FiLoader className="animate-spin" /> Resetting...</>
               ) : (
                 'Reset AI Learning'
               )}
             </button>
           </div>
         )}
         
         <div className="mb-6 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-xs text-yellow-200 text-center max-w-md">
           <strong>⚠️ Warning:</strong> Batch training simulates thousands of AI self-trained games (The AI will play against itself repeatedly for 1000 games). After training, 
           the AI will become significantly refined and will be significantly tougher to beat as it drastically optimizes its strategy and expands its knowledge context.
         </div>

      </div>

      <footer
        className="w-full py-2 px-4 sm:px-8 bg-opacity-50 text-gray-400 text-sm font-[family-name:var(--font-geist-mono)] border-t border-gray-800 mt-auto"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
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

          <div className="text-center sm:text-right">
            <p>&copy; {currentYear} Darrance Beh Heng Shek. All Rights Reserved.</p>
            <p className="text-xs text-gray-500 mt-1">
              Built with Next.js, React, FastAPI, Pydantic, Tailwind CSS. (Custom implementation of Q-learning algorithm)
            </p>
          </div>
        </div>
      </footer>

      <AIMetricsGuide 
        isOpen={showMetricsGuide} 
        onClose={() => setShowMetricsGuide(false)} 
      />

      <ConfirmModal 
        isOpen={showConfirmModal}
        {...confirmModalProps}
      />
    </main>
  );
}
