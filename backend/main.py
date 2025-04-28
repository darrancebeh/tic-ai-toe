from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Import the Q-learning agent and the winner check function
from q_learning import QLearningAgent, calculate_winner_py, State # Import State type

app = FastAPI()

# --- Add CORS Middleware --- 
origins = [
    "http://localhost:3000", # Allow Next.js default dev port
    # Add other origins if needed (e.g., deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"], # Allow GET for status
    allow_headers=["*"], # Allow all headers
)
# -------------------------

# --- Instantiate the Q-learning Agent ---
# Ensure the path is correct relative to where main.py is run
agent = QLearningAgent(q_table_file='backend/q_table.json')

# --- Request/Response Models ---
class BoardState(BaseModel):
    board: List[Optional[str]] # List of 'X', 'O', or None

class GameResult(BaseModel):
    board: List[Optional[str]]
    winner: Optional[str] # 'X', 'O', or 'Draw'

# --- Modify AI Status Model --- Re-add avg_q_change
class AIStatus(BaseModel):
    epsilon: float
    q_table_size: int
    initial_state_value: float
    avg_q_change: Optional[float] = None # Can be None before first learning step

# --- API Endpoints ---

@app.get("/ai/status", response_model=AIStatus)
def get_ai_status():
    """Returns the current status of the AI agent."""
    try:
        initial_value = agent.get_initial_state_value()
        avg_change = agent.get_last_avg_q_change() # Get the new value
        return AIStatus(
            epsilon=agent.epsilon,
            q_table_size=len(agent.q_table),
            initial_state_value=initial_value,
            avg_q_change=avg_change # Include it in the response
        )
    except Exception as e:
        print(f"Error fetching AI status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching AI status.")

@app.post("/ai/move")
def get_ai_move(state: BoardState):
    """Gets the AI's next move based on the current board state using the Q-learning agent."""
    board = state.board
    # Basic validation
    if len(board) != 9:
        raise HTTPException(status_code=400, detail="Invalid board size.")

    winner = calculate_winner_py(board)
    if winner:
        return {"move": None} # Game already finished

    try:
        action = agent.choose_action(board)
        if action is None:
             print("Warning: Agent could not choose an action on a non-terminal board.")
             # This might happen if the board is full but no winner (Draw), 
             # but calculate_winner_py should handle Draw. Could be an edge case.
             return {"move": None}
        return {"move": action}
    except Exception as e:
        print(f"Error during AI move selection: {e}")
        # Optionally reset memory if an error occurs during choice?
        # agent.reset_memory()
        raise HTTPException(status_code=500, detail="Internal server error during AI move selection.")

@app.post("/ai/learn")
def trigger_ai_learning(result: GameResult):
    """Triggers the AI learning process after a game concludes."""
    final_board_state = result.board
    winner = result.winner # Winner from the perspective of the game ('X', 'O', 'Draw')

    # Basic validation
    if len(final_board_state) != 9:
        raise HTTPException(status_code=400, detail="Invalid board size for learning.")

    # Define rewards for the AI ('O')
    if winner == 'O':
        reward = 1.0  # AI won
    elif winner == 'X':
        reward = -1.0 # AI lost
    elif winner == 'Draw':
        reward = 0.5 # Draw is better than losing
    else:
        print(f"Warning: Invalid winner '{winner}' received for learning.")
        agent.reset_memory() # Reset memory on invalid input
        raise HTTPException(status_code=400, detail="Invalid winner provided")

    try:
        agent.learn(reward, final_board_state)
        # --- Add Logging --- 
        print(f"AI learned from game. Outcome: {winner}, Reward: {reward:.1f}")
        print(f"  -> New Epsilon: {agent.epsilon:.4f}")
        print(f"  -> Q-Table Size: {len(agent.q_table)} states")
        print(f"  -> Avg Q Change: {agent.get_last_avg_q_change():.6f}") # Log the change
        # -------------------
        return {"message": "AI learning updated successfully."}
    except Exception as e:
        print(f"Error during AI learning: {e}")
        agent.reset_memory() # Reset memory on learning error
        raise HTTPException(status_code=500, detail="Internal server error during AI learning.")

# --- Server Shutdown Hook --- 
@app.on_event("shutdown")
def shutdown_event():
    """Ensures the Q-table is saved when the server shuts down."""
    print("Server shutting down. Saving Q-table...")
    agent.save_q_table()
    print("Q-table saved.")
