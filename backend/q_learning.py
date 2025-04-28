import random
import json
import os
from typing import List, Optional, Tuple, Dict
import math

# Define type aliases for clarity
State = Tuple[Optional[str], ...]
QTable = Dict[State, Dict[int, float]]

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

def rotate_board(board: List[Optional[str]]) -> List[Optional[str]]:
    """Rotates the board 90 degrees clockwise."""
    return [
        board[6], board[3], board[0],
        board[7], board[4], board[1],
        board[8], board[5], board[2]
    ]

def reflect_board(board: List[Optional[str]]) -> List[Optional[str]]:
    """Reflects the board horizontally."""
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
    current_board = list(board)

    for _ in range(4): # 4 rotations
        symmetries.append(tuple(s if s is not None else '' for s in current_board))
        symmetries.append(tuple(s if s is not None else '' for s in reflect_board(current_board)))
        current_board = rotate_board(current_board)

    # Return the lexicographically smallest tuple representation
    return min(symmetries)

class QLearningAgent:
    def __init__(self, alpha=0.1, gamma=0.9, epsilon=0.9, epsilon_decay=0.999, epsilon_min=0.01, q_table_file='q_table.json'):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.q_table_file = q_table_file
        self.q_table: QTable = self.load_q_table()
        self._memory: List[Tuple[State, int]] = []
        self._last_avg_q_change: Optional[float] = None

    def state_to_tuple(self, board: List[Optional[str]]) -> State:
        """Converts the board list to its canonical immutable tuple representation."""
        return get_canonical_state(board)

    def load_q_table(self) -> QTable:
        """Loads the Q-table from a JSON file."""
        if os.path.exists(self.q_table_file):
            try:
                with open(self.q_table_file, 'r') as f:
                    q_data = json.load(f)
                    q_table = {}
                    for state_str, actions in q_data.items():
                        state_tuple_parts = state_str.split(',')
                        state_tuple = tuple(part if part != '' else '' for part in state_tuple_parts)

                        if len(state_tuple) == 9:
                            # Ensure loaded state is canonical
                            canonical_tuple = get_canonical_state(list(state_tuple))
                            if canonical_tuple != state_tuple:
                                print(f"Warning: Non-canonical state '{state_str}' found in Q-table file. Skipping.")
                                continue
                            q_table[canonical_tuple] = {int(k): v for k, v in actions.items()}
                        else:
                            print(f"Warning: Skipping invalid state string during load: '{state_str}'")

                    print(f"Loaded Q-table with {len(q_table)} states.")
                    return q_table
            except (json.JSONDecodeError, IOError, ValueError) as e:
                print(f"Error loading Q-table: {e}. Starting with an empty table.")
                return {}
        return {}

    def save_q_table(self):
        """Saves the Q-table to a JSON file, ensuring canonical states."""
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
        return self.q_table.get(state_tuple, {}).get(action, 0.0)

    def get_initial_state_value(self) -> float:
        """Calculates the maximum Q-value for the initial empty board state."""
        initial_state: State = ('', '', '', '', '', '', '', '', '')
        available_actions = list(range(9))

        if not self.q_table.get(initial_state):
            return 0.0

        q_values = [self.get_q_value(initial_state, action) for action in available_actions]

        if not q_values:
             return 0.0

        return max(q_values)

    def get_last_avg_q_change(self) -> Optional[float]:
        """Returns the average Q-value change from the last learning step."""
        return self._last_avg_q_change

    def get_available_actions(self, board: List[Optional[str]]) -> List[int]:
        """Returns a list of indices of empty cells."""
        if len(board) != 9:
            print(f"Warning: Received board with invalid length {len(board)}")
            return []
        return [i for i, spot in enumerate(board) if spot is None or spot == '']

    def choose_action(self, board: List[Optional[str]]) -> Optional[int]:
        """Chooses an action using rules (win/block) then epsilon-greedy strategy on the canonical state."""
        available_actions = self.get_available_actions(board)
        if not available_actions:
            return None

        # Rule: Win if possible
        for action in available_actions:
            temp_board = list(board)
            temp_board[action] = 'O'
            if calculate_winner_py(temp_board) == 'O':
                # print("AI Debug: Choosing immediate win") # Removed debug print
                canonical_state = self.state_to_tuple(board)
                self._memory.append((canonical_state, action))
                return action

        # Rule: Block opponent win if necessary
        for action in available_actions:
            temp_board = list(board)
            temp_board[action] = 'X'
            if calculate_winner_py(temp_board) == 'X':
                # print("AI Debug: Choosing immediate block") # Removed debug print
                canonical_state = self.state_to_tuple(board)
                self._memory.append((canonical_state, action))
                return action

        # Epsilon-Greedy based on Canonical State
        canonical_state = self.state_to_tuple(board)
        if random.uniform(0, 1) < self.epsilon:
            action = random.choice(available_actions) # Explore
            # print(f"AI Debug: Exploring (Epsilon: {self.epsilon:.3f})") # Removed debug print
        else:
            # Exploit: Choose the best known action from the canonical state
            q_values = {act: self.get_q_value(canonical_state, act) for act in available_actions}
            max_q = -float('inf')
            if not q_values:
                 action = random.choice(available_actions)
                 # print(f"AI Debug: No Q-values found for canonical state, choosing randomly.") # Removed debug print
            elif all(q == 0.0 for q in q_values.values()):
                 action = random.choice(available_actions)
                 # print(f"AI Debug: All Q-values are 0 for canonical state, exploring randomly.") # Removed debug print
                 max_q = 0.0
            else:
                 max_q = max(q_values.values())
                 best_actions = [act for act, q in q_values.items() if q == max_q]
                 action = random.choice(best_actions)
                 # print(f"AI Debug: Exploiting canonical state (Q-val: {max_q:.3f})") # Removed debug print

        self._memory.append((canonical_state, action))
        return action

    def learn(self, reward: float, final_board_state_list: List[Optional[str]]):
        """Updates Q-values for the sequence of canonical states in the last game."""
        if not self._memory:
            self._last_avg_q_change = 0.0
            return

        total_q_change = 0.0
        num_updates = 0

        final_reward_applied = False
        # Determine max_next_q based on the actual final board state
        final_canonical_state = self.state_to_tuple(final_board_state_list)
        final_available_actions = self.get_available_actions(final_board_state_list)
        if not final_available_actions or calculate_winner_py(final_board_state_list) is not None:
            max_next_q = 0.0 # Terminal state value is 0
        else:
            # This case should ideally not happen if learn is called correctly after game end
            max_next_q = max(self.get_q_value(final_canonical_state, act) for act in final_available_actions)

        for i in reversed(range(len(self._memory))):
            state, action = self._memory[i]
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
            if state in self.q_table:
                 max_next_q = max(self.q_table[state].values()) if self.q_table[state] else 0.0
            else:
                 max_next_q = 0.0

        self._last_avg_q_change = (total_q_change / num_updates) if num_updates > 0 else 0.0

        # Decay epsilon
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
            self.epsilon = max(self.epsilon_min, self.epsilon)

        self._memory = []

    def reset_memory(self):
        """Clears the memory of the current game without learning."""
        self._memory = []
        
    def reset_learning(self):
        """Resets the AI's learning by clearing the Q-table and resetting parameters."""
        self.q_table = {}
        self.epsilon = 0.9 # Reset epsilon to initial value
        self._memory = []
        self._last_avg_q_change = None
        self.save_q_table()
        print("AI learning has been reset: Q-table cleared and parameters reset.")
        return True

