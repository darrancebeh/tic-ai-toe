from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Import the Q-learning agent and the winner check function
from q_learning import QLearningAgent, calculate_winner_py # Updated import

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
    allow_methods=["POST"], # Allow only POST for this endpoint
    allow_headers=["*"], # Allow all headers
)
# -------------------------

# --- Instantiate the Q-learning Agent ---
agent = QLearningAgent(q_table_file='backend/q_table.json')

# --- Request/Response Models ---
class BoardState(BaseModel):
    board: List[Optional[str]] # List of 'X', 'O', or None

class GameResult(BaseModel):
    board: List[Optional[str]]
    winner: Optional[str] # 'X', 'O', or 'Draw'

# --- API Endpoints ---

@app.post("/ai/move")
def get_ai_move(state: BoardState):
    """Gets the AI's next move based on the current board state using the Q-learning agent."""
    board = state.board
    # Use the imported function for checks if needed here, though agent handles it now
    winner = calculate_winner_py(board)

    if winner:
        # Game already finished
        return {"move": None}

    # Use the agent to choose the action (move index)
    action = agent.choose_action(board)

    if action is None:
         print("Warning: Agent could not choose an action on a non-terminal board.")
         return {"move": None}

    return {"move": action}


@app.post("/ai/learn")
def trigger_ai_learning(result: GameResult):
    """Triggers the AI learning process after a game concludes."""
    final_board_state = result.board
    winner = result.winner # Winner from the perspective of the game ('X', 'O', 'Draw')

    # Define rewards for the AI ('O')
    if winner == 'O':
        reward = 1.0  # AI won
    elif winner == 'X':
        reward = -1.0 # AI lost
    elif winner == 'Draw':
        reward = 0.5 # Draw is better than losing
    else:
        print(f"Warning: Invalid winner '{winner}' received for learning.")
        agent.reset_memory()
        raise HTTPException(status_code=400, detail="Invalid winner provided")

    try:
        agent.learn(reward, final_board_state)
        # --- Add Logging --- 
        print(f"AI learned from game. Outcome: {winner}, Reward: {reward:.1f}")
        print(f"  -> New Epsilon: {agent.epsilon:.4f}")
        print(f"  -> Q-Table Size: {len(agent.q_table)} states")
        # -------------------
        return {"message": "AI learning updated successfully."}
    except Exception as e:
        print(f"Error during AI learning: {e}")
        agent.reset_memory()
        raise HTTPException(status_code=500, detail="Internal server error during AI learning.")


# --- Server Shutdown Hook --- 
@app.on_event("shutdown")
def shutdown_event():
    """Ensures the Q-table is saved when the server shuts down."""
    print("Server shutting down. Saving Q-table...")
    agent.save_q_table()
    print("Q-table saved.")
