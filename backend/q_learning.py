import random
import json
import os
from typing import List, Optional, Tuple, Dict
import math # Import math for isnan

# Define type aliases for clarity
State = Tuple[Optional[str], ...]
QTable = Dict[State, Dict[int, float]]

# --- Helper function to calculate winner --- 
# (Moved from main.py)
def calculate_winner_py(squares: List[Optional[str]]) -> Optional[str]:
    lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], # rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], # columns
        [0, 4, 8], [2, 4, 6]             # diagonals
    ]
    for a, b, c in lines:
        if squares[a] and squares[a] == squares[b] and squares[a] == squares[c]:
            return squares[a]
    if all(s is not None for s in squares):
        return 'Draw'
    return None
# -----------------------------------------

# --- Symmetry Helper Functions --- 
def rotate_board(board: List[Optional[str]]) -> List[Optional[str]]:
    """Rotates the board 90 degrees clockwise."""
    # 0 1 2   ->  6 3 0
    # 3 4 5   ->  7 4 1
    # 6 7 8   ->  8 5 2
    return [
        board[6], board[3], board[0],
        board[7], board[4], board[1],
        board[8], board[5], board[2]
    ]

def reflect_board(board: List[Optional[str]]) -> List[Optional[str]]:
    """Reflects the board horizontally."""
    # 0 1 2   ->  2 1 0
    # 3 4 5   ->  5 4 3
    # 6 7 8   ->  8 7 6
    return [
        board[2], board[1], board[0],
        board[5], board[4], board[3],
        board[8], board[7], board[6]
    ]

def get_canonical_state(board: List[Optional[str]]) -> State:
    """Finds the canonical representation of a board state among its 8 symmetries."""
    if len(board) != 9:
        # Return a default or raise error for invalid input
        return tuple('' for _ in range(9))

    symmetries = []
    current_board = list(board) # Start with a mutable copy

    for _ in range(4): # 4 rotations
        symmetries.append(tuple(s if s is not None else '' for s in current_board))
        symmetries.append(tuple(s if s is not None else '' for s in reflect_board(current_board)))
        current_board = rotate_board(current_board)

    # Return the lexicographically smallest tuple representation
    return min(symmetries)
# --------------------------------

class QLearningAgent:
    def __init__(self, alpha=0.1, gamma=0.9, epsilon=0.9, epsilon_decay=0.999, epsilon_min=0.01, q_table_file='q_table.json'): # Adjusted decay and min_epsilon
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.q_table_file = q_table_file
        self.q_table: QTable = self.load_q_table()
        self._memory: List[Tuple[State, int]] = []
        self._last_avg_q_change: Optional[float] = None # Ensure this is present

    def state_to_tuple(self, board: List[Optional[str]]) -> State:
        """Converts the board list to its canonical immutable tuple representation."""
        # --- Use Canonical State --- 
        return get_canonical_state(board)
        # -------------------------

    def load_q_table(self) -> QTable:
        """Loads the Q-table from a JSON file."""
        if os.path.exists(self.q_table_file):
            try:
                with open(self.q_table_file, 'r') as f:
                    # Convert string keys back to integer actions
                    q_data = json.load(f)
                    q_table = {}
                    for state_str, actions in q_data.items():
                        # Convert state string representation back to tuple
                        state_tuple_parts = state_str.split(',')
                        # Convert empty strings back to None for consistency before canonical check? No, canonical uses ''
                        state_tuple = tuple(part if part != '' else '' for part in state_tuple_parts)

                        if len(state_tuple) == 9:
                            # --- Ensure loaded state is canonical --- 
                            # Although saving should ensure this, double-check on load
                            canonical_tuple = get_canonical_state(list(state_tuple)) # Convert back to list for function
                            if canonical_tuple != state_tuple:
                                print(f"Warning: Non-canonical state '{state_str}' found in Q-table file. Skipping.")
                                continue
                            # ---------------------------------------
                            q_table[canonical_tuple] = {int(k): v for k, v in actions.items()}
                        else:
                            print(f"Warning: Skipping invalid state string during load: '{state_str}'")

                    print(f"Loaded Q-table with {len(q_table)} states.")
                    # --- Add check for states after loading --- 
                    if q_table:
                        print(f"  Example state key from loaded table: {next(iter(q_table.keys()))}")
                    # -----------------------------------------
                    return q_table
            except (json.JSONDecodeError, IOError, ValueError) as e: # Added ValueError for int conversion
                print(f"Error loading Q-table: {e}. Starting with an empty table.")
                return {}
        return {}

    def save_q_table(self):
        """Saves the Q-table to a JSON file, ensuring canonical states."""
        # No change needed here if self.q_table only ever contains canonical states
        try:
            q_data = {}
            for state_tuple, actions in self.q_table.items():
                # state_tuple should already be canonical
                state_str = ",".join(str(s) if s is not None else '' for s in state_tuple)
                q_data[state_str] = actions

            with open(self.q_table_file, 'w') as f:
                json.dump(q_data, f, indent=4)
        except IOError as e:
            print(f"Error saving Q-table: {e}")

    def get_q_value(self, state_tuple: State, action: int) -> float:
        """Gets the Q-value for a canonical state-action pair, defaulting to 0."""
        # state_tuple is assumed to be canonical because state_to_tuple produces it
        return self.q_table.get(state_tuple, {}).get(action, 0.0)

    def get_initial_state_value(self) -> float:
        """Calculates the maximum Q-value for the initial empty board state."""
        # The canonical empty state is always the same
        initial_state: State = ('', '', '', '', '', '', '', '', '')
        available_actions = list(range(9)) # All spots are available initially

        if not self.q_table.get(initial_state):
            # If the initial state hasn't been encountered or learned from yet
            return 0.0 # Default to 0 before learning

        # Get Q-values for all possible first moves from the empty state
        q_values = [self.get_q_value(initial_state, action) for action in available_actions]

        if not q_values:
             return 0.0 # Should not happen, but safety check

        # Return the maximum Q-value, representing the AI's expected outcome
        return max(q_values)

    # --- RE-ADD Method ---
    def get_last_avg_q_change(self) -> Optional[float]:
        """Returns the average Q-value change from the last learning step."""
        return self._last_avg_q_change
    # ---------------------

    def get_available_actions(self, board: List[Optional[str]]) -> List[int]:
        """Returns a list of indices of empty cells."""
        # Ensure board has 9 elements before processing
        if len(board) != 9:
            print(f"Warning: Received board with invalid length {len(board)}")
            return []
        return [i for i, spot in enumerate(board) if spot is None or spot == '']

    def choose_action(self, board: List[Optional[str]]) -> Optional[int]:
        """Chooses an action using rules (win/block) then epsilon-greedy strategy on the canonical state."""
        available_actions = self.get_available_actions(board)
        if not available_actions:
            return None # No action possible

        # --- Rules based on actual board --- 
        # Rules should operate on the *current* board orientation, not canonical
        for action in available_actions:
            temp_board = list(board)
            temp_board[action] = 'O'
            if calculate_winner_py(temp_board) == 'O':
                print("AI Debug: Choosing immediate win")
                canonical_state = self.state_to_tuple(board) # Get canonical state for memory
                self._memory.append((canonical_state, action))
                return action

        for action in available_actions:
            temp_board = list(board)
            temp_board[action] = 'X'
            if calculate_winner_py(temp_board) == 'X':
                print("AI Debug: Choosing immediate block")
                canonical_state = self.state_to_tuple(board) # Get canonical state for memory
                self._memory.append((canonical_state, action))
                return action
        # -----------------------------------

        # --- Epsilon-Greedy based on Canonical State --- 
        canonical_state = self.state_to_tuple(board)
        if random.uniform(0, 1) < self.epsilon:
            action = random.choice(available_actions) # Explore
            print(f"AI Debug: Exploring (Epsilon: {self.epsilon:.3f})")
        else:
            # Exploit: Choose the best known action from the canonical state
            q_values = {act: self.get_q_value(canonical_state, act) for act in available_actions}
            max_q = -float('inf')
            # Handle states with no Q-values yet - default to 0
            if not q_values: # Should not happen if available_actions is not empty
                 action = random.choice(available_actions)
                 print(f"AI Debug: No Q-values found for canonical state, choosing randomly.")
            elif all(q == 0.0 for q in q_values.values()):
                 # If all known Q-values are 0, choose randomly among available actions
                 action = random.choice(available_actions)
                 print(f"AI Debug: All Q-values are 0 for canonical state, exploring randomly.")
                 max_q = 0.0
            else:
                 max_q = max(q_values.values())
                 best_actions = [act for act, q in q_values.items() if q == max_q]
                 action = random.choice(best_actions) # Choose randomly among best actions
                 print(f"AI Debug: Exploiting canonical state (Q-val: {max_q:.3f})")

        self._memory.append((canonical_state, action))
        return action
        # ---------------------------------------------

    def learn(self, reward: float, final_board_state_list: List[Optional[str]]):
        """Updates Q-values for the sequence of canonical states in the last game."""
        # Note: self._memory already contains canonical states from choose_action
        if not self._memory:
            self._last_avg_q_change = 0.0
            return

        total_q_change = 0.0
        num_updates = 0

        final_reward_applied = False
        # --- Determine max_next_q based on the actual final board state --- 
        # The final state might not have been added to memory if game ended before AI move
        final_canonical_state = self.state_to_tuple(final_board_state_list)
        final_available_actions = self.get_available_actions(final_board_state_list)
        if not final_available_actions or calculate_winner_py(final_board_state_list) is not None:
            max_next_q = 0.0 # Terminal state value is 0
        else:
            # This case should ideally not happen if learn is called correctly after game end
            # but if it does, calculate max Q from the final canonical state
            max_next_q = max(self.get_q_value(final_canonical_state, act) for act in final_available_actions)
        # ------------------------------------------------------------------

        for i in reversed(range(len(self._memory))):
            state, action = self._memory[i] # state is already canonical
            current_q = self.get_q_value(state, action)

            current_reward = reward if not final_reward_applied else 0.0
            final_reward_applied = True

            new_q = current_q + self.alpha * (current_reward + self.gamma * max_next_q - current_q)

            q_change = abs(new_q - current_q)
            if not math.isnan(q_change):
                total_q_change += q_change
                num_updates += 1

            if state not in self.q_table:
                self.q_table[state] = {}
            self.q_table[state][action] = new_q

            # Update max_next_q for the *next* iteration (previous state in sequence)
            # This needs the Q-values of the *current* canonical state (state)
            # We need the available actions from the board orientation that *led* to this canonical state.
            # This is tricky because memory only stores the canonical state.
            # Assumption: The available actions don't change based on symmetry for Q-learning update.
            # We can find the max Q value directly from the canonical state's known actions.
            if state in self.q_table:
                 # Find max Q-value among actions known for this canonical state
                 max_next_q = max(self.q_table[state].values()) if self.q_table[state] else 0.0
            else:
                 max_next_q = 0.0 # If state wasn't in q_table, max_next is 0

        self._last_avg_q_change = (total_q_change / num_updates) if num_updates > 0 else 0.0

        # Decay epsilon after the learning step for the game
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
            self.epsilon = max(self.epsilon_min, self.epsilon)

        self._memory = []

    def reset_memory(self):
        """Clears the memory of the current game without learning."""
        self._memory = []
        # Do not reset _last_avg_q_change here, let it persist until next learn()

