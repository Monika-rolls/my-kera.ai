import { AGENT_STATE_TO_AVATAR, type AvatarBaseState, type AvatarDataEvent } from './avatarConfig'

export class AvatarStateMachine {
  resolve(agentState: string, event?: AvatarDataEvent | null): AvatarBaseState {
    if (event?.state && this.isValidBase(event.state)) {
      return event.state as AvatarBaseState
    }
    return AGENT_STATE_TO_AVATAR[agentState] ?? 'idle'
  }

  private isValidBase(s: string): boolean {
    return ['idle','listening','thinking','speaking','happy','concern','goodbye'].includes(s)
  }
}
