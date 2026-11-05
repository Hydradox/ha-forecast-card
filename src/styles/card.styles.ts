import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    container-type: inline-size; /* responsive to the card width, not the viewport */
  }
  ha-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--hfc-text);
  }
  ha-card.interactive,
  .temperature.interactive {
    cursor: pointer;
  }
  ha-card:focus-visible,
  .temperature:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header .icon {
    width: 56px;
    height: 56px;
    flex: none;
    border-radius: 50%;
    background: var(--hfc-circle, transparent);
  }
  .header .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .secondary {
    color: var(--hfc-text-secondary);
    font-size: 12px;
  }
  .state {
    font-size: 16px;
    font-weight: 500;
  }
  .temperature {
    font-size: 34px;
    font-weight: 300;
    line-height: 1;
  }
  .temperature .unit {
    font-size: 16px;
    color: var(--hfc-text-secondary);
  }
  .empty {
    color: var(--hfc-text-secondary);
    text-align: center;
    padding: 24px 0;
  }
`;
