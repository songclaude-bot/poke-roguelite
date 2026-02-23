// Simple turn-based system: Player acts → All enemies act → next turn

export type TurnAction = () => Promise<void>;

export class TurnManager {
  private turnNumber = 0;
  private processing = false;

  get turn(): number {
    return this.turnNumber;
  }

  get isBusy(): boolean {
    return this.processing;
  }

  /**
   * Execute a full turn: player action, then all enemy actions.
   */
  async executeTurn(
    playerAction: TurnAction,
    enemyActions: TurnAction[]
  ): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    // Player acts first
    await playerAction();

    // Then each enemy acts in order
    for (const action of enemyActions) {
      await action();
    }

    this.turnNumber++;
    this.processing = false;
  }
}
