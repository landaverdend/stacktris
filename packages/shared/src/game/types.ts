

export type MovementAction = 'move_left' | 'move_right' | 'rotate_cw' | 'rotate_ccw' | 'move_down'

export type InputAction = MovementAction | 'soft_drop' | 'hard_drop' | 'hold';