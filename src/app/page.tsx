'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FiGithub, FiLinkedin, FiTwitter, FiMail, FiInfo, FiLoader, FiRotateCcw, FiX } from 'react-icons/fi';

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
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full p-6 text-gray-300">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-purple-400">Understanding our Toe AI Metrics</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close metrics guide"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="space-y-5 text-sm leading-relaxed">
          <p>
            Our Tic-Tac-Toe AI uses a Q-learning algorithm to learn and improve its gameplay over time. 
            Here&apos;s a breakdown of the key metrics you&apos;ll see:
          </p>

          <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600">
            <h3 className="text-md font-semibold text-purple-300 mb-1">Difficulty (Epsilon - ε)</h3>
            <p>
              Epsilon (ε) represents the AI&apos;s exploration rate. A higher epsilon means the AI is more likely to make random moves to explore new strategies. 
              As the AI learns, epsilon decreases, making it play more optimally (exploitation).
            </p>
            <ul className="list-disc list-inside mt-1 pl-2 text-xs text-gray-400 space-y-0.5">
              <li><strong className="text-gray-300">Easy (ε &gt; 0.5):</strong> AI is in a high exploration phase, expect more random moves.</li>
              <li><strong className="text-gray-300">Medium (0.15 ≤ ε ≤ 0.5):</strong> AI balances exploration and exploitation.</li>
              <li><strong className="text-gray-300">Hard (ε &lt; 0.15):</strong> AI primarily exploits its learned knowledge, playing more strategically.</li>
            </ul>
          </div>

          <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600">
            <h3 className="text-md font-semibold text-purple-300 mb-1">Knowledge Score</h3>
            <p>
              This score (0-100) indicates how much of the possible game states the AI has encountered and learned from (i.e., the size of its Q-table relative to the theoretical maximum for Tic-Tac-Toe).
              A higher score means the AI has a more comprehensive understanding of the game.
            </p>
            <p className="mt-1 text-xs text-gray-400 italic">
              Tic-tac-toe is a &quot;solved game&quot; with perfect play. With sufficient training, an AI can learn the perfect strategy that guarantees at least a draw against any opponent.
            </p>
          </div>

          <div className="p-3 bg-gray-700/50 rounded-md border border-gray-600">
            <h3 className="text-md font-semibold text-purple-300 mb-1">Learning Rate (Avg. Q Change)</h3>
            <p>
              This metric shows the average change in the AI&apos;s Q-values during its last learning update. 
              A higher value indicates significant learning or adjustments in strategy. As the AI masters the game, this value will approach zero.
            </p>
            <p className="mt-1 text-xs text-gray-400 italic">Note: As learning rate approaches zero, the AI has essentially &quot;solved&quot; the game and further training produces diminishing returns.</p>
          </div>
          
          <p className="text-xs text-center text-gray-500 pt-2">
            The AI learns from each game played, including batch training sessions where it plays against itself thousands of times to rapidly improve.
          </p>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Got it!
          </button>
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
      message: "Are you sure you want to reset the AI&apos;s learning? This will delete all its learned knowledge and reset scores.",
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
      const currentBoard = [...prevBoard];
      const winnerInfo = calculateWinner(currentBoard);

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
        status = <span className="font-bold text-yellow-500">It&apos;s a Draw!</span>;
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
            {currentPlayer === 'X' ? 'Your Turn (X)' : "AI&apos;s Turn (O)"}
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
        <h1 className="text-4xl font-bold mb-4">
          <span>Tic-AI-Toe</span>
          <span className="text-lg font-normal text-gray-400 ml-2">by db</span>
        </h1>

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
               disabled={(!gameStarted && !winnerInfo.winner) || (!winnerInfo.winner && gameStarted) || isThinking || isBatchTraining || isResettingAI}
               className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto flex items-center justify-center gap-2"
               title={(!gameStarted && !winnerInfo.winner) ? "Place a move on the board to start" : (!winnerInfo.winner && gameStarted) ? "Finish the current game before starting a new one" : ""}
             >
               {!gameStarted && !winnerInfo.winner ? 
                 "Place a Move to Start Game" : 
                 <><FiRotateCcw /> {winnerInfo.winner ? "Play Again" : "Play Again"}</>
               }
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
