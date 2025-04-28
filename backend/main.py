from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from q_learning import QLearningAgent, calculate_winner_py, State

app = FastAPI()

origins = [
    "http://localhost:3000", # Allow Next.js default dev port
    # Add other origins if needed (e.g., deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Ensure the path is correct relative to where main.py is run
agent = QLearningAgent(q_table_file='backend/q_table.json')

class BoardState(BaseModel):
    board: List[Optional[str]]

class GameResult(BaseModel):
    board: List[Optional[str]]
    winner: Optional[str]

class TrainParams(BaseModel):
    num_rounds: int = 1000

class AIStatus(BaseModel):
    epsilon: float
    q_table_size: int
    initial_state_value: float
    avg_q_change: Optional[float] = None


@app.get("/ai/status", response_model=AIStatus)
def get_ai_status():
    """Returns the current status of the AI agent."""
    try:
        initial_value = agent.get_initial_state_value()
        avg_change = agent.get_last_avg_q_change()
        return AIStatus(
            epsilon=agent.epsilon,
            q_table_size=len(agent.q_table),
            initial_state_value=initial_value,
            avg_q_change=avg_change
        )
    except Exception as e:
        print(f"Error fetching AI status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching AI status.")

@app.post("/ai/move")
def get_ai_move(state: BoardState):
    """Gets the AI's next move based on the current board state using the Q-learning agent."""
    board = state.board
    if len(board) != 9:
        raise HTTPException(status_code=400, detail="Invalid board size.")

    winner = calculate_winner_py(board)
    if winner:
        return {"move": None} # Game already finished

    try:
        action = agent.choose_action(board)
        if action is None:
             print("Warning: Agent could not choose an action on a non-terminal board.")
             return {"move": None}
        return {"move": action}
    except Exception as e:
        print(f"Error during AI move selection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during AI move selection.")

@app.post("/ai/learn")
def trigger_ai_learning(result: GameResult):
    """Triggers the AI learning process after a game concludes."""
    final_board_state = result.board
    winner = result.winner

    if len(final_board_state) != 9:
        raise HTTPException(status_code=400, detail="Invalid board size for learning.")

    if winner == 'O':
        reward = 1.0
    elif winner == 'X':
        reward = -1.0
    elif winner == 'Draw':
        reward = 0.5
    else:
        print(f"Warning: Invalid winner '{winner}' received for learning.")
        agent.reset_memory()
        raise HTTPException(status_code=400, detail="Invalid winner provided")

    try:
        agent.learn(reward, final_board_state)
        print(f"AI learned from game. Outcome: {winner}, Reward: {reward:.1f}")
        print(f"  -> New Epsilon: {agent.epsilon:.4f}")
        print(f"  -> Q-Table Size: {len(agent.q_table)} states")
        print(f"  -> Avg Q Change: {agent.get_last_avg_q_change():.6f}")
        return {"message": "AI learning updated successfully."}
    except Exception as e:
        print(f"Error during AI learning: {e}")
        agent.reset_memory()
        raise HTTPException(status_code=500, detail="Internal server error during AI learning.")

@app.post("/ai/train_batch", response_model=AIStatus)
def run_batch_training(params: TrainParams):
    """Runs multiple self-play games on the backend for faster training."""
    num_rounds = params.num_rounds
    if num_rounds <= 0:
        raise HTTPException(status_code=400, detail="Number of rounds must be positive.")

    print(f"--- Starting Batch Training ({num_rounds} rounds) ---")
    games_played = 0
    x_wins = 0
    o_wins = 0
    draws = 0

    try:
        for i in range(num_rounds):
            board: List[Optional[str]] = [None] * 9
            current_player = 'X'
            agent.reset_memory()

            while True:
                winner = calculate_winner_py(board)
                if winner is not None:
                    break

                available_actions = agent.get_available_actions(board)
                if not available_actions:
                    winner = 'Draw'
                    break

                action = agent.choose_action(board)

                if action is None or board[action] is not None:
                    print(f"Error in batch training round {i+1}: Invalid action {action} chosen for board {board}")
                    winner = 'Error'
                    break

                board[action] = current_player
                current_player = 'O' if current_player == 'X' else 'X'

            if winner != 'Error':
                games_played += 1
                if winner == 'X':
                    x_wins += 1
                    reward = -1.0
                elif winner == 'O':
                    o_wins += 1
                    reward = 1.0
                else: # Draw
                    draws += 1
                    reward = 0.5

                agent.learn(reward, board)
            else:
                agent.reset_memory()

            if (i + 1) % (num_rounds // 10 if num_rounds >= 10 else 1) == 0:
                print(f"  Batch Training Progress: {i + 1}/{num_rounds} rounds completed...")

        agent.save_q_table()
        print(f"--- Batch Training Finished ---")
        print(f"  Results ({games_played} valid games): X Wins: {x_wins}, O Wins: {o_wins}, Draws: {draws}")
        print(f"  Final Epsilon: {agent.epsilon:.4f}, Q-Table Size: {len(agent.q_table)}")

        return get_ai_status()

    except Exception as e:
        print(f"Error during batch training: {e}")
        agent.save_q_table()
        raise HTTPException(status_code=500, detail=f"Internal server error during batch training: {e}")

@app.post("/ai/reset", response_model=AIStatus)
def reset_ai_learning():
    """Resets the AI's learning by clearing its Q-table and resetting parameters."""
    try:
        print("--- Resetting AI Learning ---")
        agent.reset_learning()
        print("--- AI Learning Reset Complete ---")
        
        return get_ai_status()
    except Exception as e:
        print(f"Error during AI learning reset: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error during AI learning reset: {e}")

@app.on_event("shutdown")
def shutdown_event():
    """Ensures the Q-table is saved when the server shuts down."""
    print("Server shutting down. Saving Q-table...")
    agent.save_q_table()
    print("Q-table saved.")
