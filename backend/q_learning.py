import random
import json
import os
from typing import List, Optional, Tuple, Dict

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

class QLearningAgent:
    def __init__(self, alpha=0.1, gamma=0.9, epsilon=0.9, epsilon_decay=0.995, epsilon_min=0.05, q_table_file='q_table.json'):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.q_table_file = q_table_file
        self.q_table: QTable = self.load_q_table()
        self._memory: List[Tuple[State, int]] = []

    def state_to_tuple(self, board: List[Optional[str]]) -> State:
        """Converts the board list to an immutable tuple for use as a dictionary key."""
        # Replace None with a placeholder string like '' for consistent hashing
        return tuple(s if s is not None else '' for s in board)

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
                        state_tuple = tuple(state_str.split(',') ) # Assuming comma separation
                        q_table[state_tuple] = {int(k): v for k, v in actions.items()}
                    print(f"Loaded Q-table with {len(q_table)} states.")
                    return q_table
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error loading Q-table: {e}. Starting with an empty table.")
                return {}
        return {}

    def save_q_table(self):
        """Saves the Q-table to a JSON file."""
        try:
            # Convert tuple states to string representations for JSON
            q_data = {}
            for state_tuple, actions in self.q_table.items():
                state_str = ",".join(state_tuple) # Simple comma separation
                q_data[state_str] = actions # Actions are already JSON serializable (int keys, float values)

            with open(self.q_table_file, 'w') as f:
                json.dump(q_data, f, indent=4)
            # print(f"Saved Q-table with {len(self.q_table)} states.") # Optional: can be verbose
        except IOError as e:
            print(f"Error saving Q-table: {e}")

    def get_q_value(self, state: State, action: int) -> float:
        """Gets the Q-value for a state-action pair, defaulting to 0."""
        return self.q_table.get(state, {}).get(action, 0.0)

    def get_initial_state_value(self) -> float:
        """Calculates the maximum Q-value for the initial empty board state."""
        initial_state: State = ('', '', '', '', '', '', '', '', '') # Empty board tuple
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

    def get_available_actions(self, board: List[Optional[str]]) -> List[int]:
        """Returns a list of indices of empty cells."""
        return [i for i, spot in enumerate(board) if spot is None]

    def choose_action(self, board: List[Optional[str]]) -> Optional[int]:
        """Chooses an action using rules (win/block) then epsilon-greedy strategy."""
        available_actions = self.get_available_actions(board)
        if not available_actions:
            return None # No action possible

        # --- Rule 1: Check for immediate AI win --- 
        for action in available_actions:
            temp_board = list(board) # Create a copy
            temp_board[action] = 'O' # Simulate AI move
            if calculate_winner_py(temp_board) == 'O':
                print("AI Debug: Choosing immediate win")
                state = self.state_to_tuple(board)
                self._memory.append((state, action))
                return action

        # --- Rule 2: Check for immediate Player block --- 
        for action in available_actions:
            temp_board = list(board)
            temp_board[action] = 'X' # Simulate Player move
            if calculate_winner_py(temp_board) == 'X':
                print("AI Debug: Choosing immediate block")
                state = self.state_to_tuple(board)
                self._memory.append((state, action))
                return action

        # --- Rule 3: Epsilon-Greedy (Existing Logic) --- 
        state = self.state_to_tuple(board)
        if random.uniform(0, 1) < self.epsilon:
            action = random.choice(available_actions) # Explore
            print(f"AI Debug: Exploring (Epsilon: {self.epsilon:.3f})")
        else:
            # Exploit: Choose the best known action
            q_values = {act: self.get_q_value(state, act) for act in available_actions}
            max_q = -float('inf')
            # Handle states with no Q-values yet - default to 0
            if not any(q != 0.0 for q in q_values.values()):
                 max_q = 0.0 # If all are 0 (or state is new), treat max as 0
            else:
                 max_q = max(q_values.values())

            best_actions = [act for act, q in q_values.items() if q == max_q]
            action = random.choice(best_actions) # Choose randomly among best actions
            print(f"AI Debug: Exploiting (Q-val: {max_q:.3f})")

        self._memory.append((state, action))
        return action

    def learn(self, reward: float, final_board_state: List[Optional[str]]):
        """Updates Q-values for the sequence of moves made in the last game."""
        if not self._memory:
            return # Nothing to learn if no moves were made

        next_state = self.state_to_tuple(final_board_state)
        # The final reward applies directly to the last state-action pair
        last_state, last_action = self._memory[-1]
        current_q = self.get_q_value(last_state, last_action)
        # For the terminal state, the future reward component is 0
        new_q = current_q + self.alpha * (reward - current_q)
        if last_state not in self.q_table:
            self.q_table[last_state] = {}
        self.q_table[last_state][last_action] = new_q

        # Propagate rewards back through the game sequence
        next_max_q = 0.0 # Since the game ended, the value of the final state is the reward itself

        for i in reversed(range(len(self._memory) - 1)):
            state, action = self._memory[i]
            next_state_temp, _ = self._memory[i+1]

            # Find max Q-value for the *next* state based on available actions *then*
            # This requires simulating the available actions from next_state_temp, which is complex.
            # Simplification: Use the Q-value of the action *actually taken* in the next state as the estimate.
            # A better way: Calculate max_q for the next_state based on current Q-table.
            next_available_actions = self.get_available_actions(list(next_state_temp)) # Need to convert tuple back to list temporarily
            if not next_available_actions:
                 max_next_q = 0.0 # Terminal state reached earlier than expected?
            else:
                 max_next_q = max(self.get_q_value(next_state_temp, next_action) for next_action in next_available_actions)


            current_q = self.get_q_value(state, action)
            new_q = current_q + self.alpha * (self.gamma * max_next_q - current_q)

            if state not in self.q_table:
                self.q_table[state] = {}
            self.q_table[state][action] = new_q
            # The reward is only applied at the end, the propagation uses gamma * max_next_q

        # Decay epsilon
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        # Clear memory for the next game
        self._memory = []
        self.save_q_table() # Save after learning from a game

    def reset_memory(self):
        """Clears the memory of the current game without learning (e.g., on server restart or error)."""
        self._memory = []

