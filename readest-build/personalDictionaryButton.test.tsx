import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnnotationToolButton from '@/app/reader/components/annotator/AnnotationToolButton';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe('dictionary tap and long-press ownership', () => {
  const setup = () => {
    const click = vi.fn(),
      hold = vi.fn();
    render(
      <AnnotationToolButton
        showTooltip={false}
        tooltipText='사전'
        Icon={() => null}
        onClick={click}
        onLongPress={hold}
      />,
    );
    return { click, hold, button: screen.getByRole('button', { name: '사전' }) };
  };
  it('a normal tap invokes only dictionary 1', () => {
    const { click, hold, button } = setup();
    fireEvent.click(button);
    expect(click).toHaveBeenCalledTimes(1);
    expect(hold).not.toHaveBeenCalled();
  });
  it('a held pointer invokes dictionary 2 once and suppresses the trailing click', () => {
    vi.useFakeTimers();
    const { click, hold, button } = setup();
    fireEvent.pointerDown(button);
    vi.advanceTimersByTime(550);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(hold).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
  });
  it('cancelled touch cannot fire either dictionary', () => {
    vi.useFakeTimers();
    const { click, hold, button } = setup();
    fireEvent.pointerDown(button);
    fireEvent.pointerCancel(button);
    vi.advanceTimersByTime(600);
    expect(hold).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});

it('dictionary pointer down preserves the iframe selection by preventing focus transfer', () => {
  render(
    <AnnotationToolButton
      showTooltip={false}
      tooltipText='사전'
      Icon={() => null}
      onClick={() => {}}
      onLongPress={() => {}}
    />,
  );
  expect(
    fireEvent.pointerDown(screen.getByRole('button', { name: '사전' }), { cancelable: true }),
  ).toBe(false);
});

it('dictionary touch start keeps the selected text and does not bubble into reader gestures', () => {
  render(
    <AnnotationToolButton
      showTooltip={false}
      tooltipText='사전'
      Icon={() => null}
      onClick={() => {}}
      onLongPress={() => {}}
    />,
  );
  expect(
    fireEvent.touchStart(screen.getByRole('button', { name: '사전' }), { cancelable: true }),
  ).toBe(false);
});

it('a touch release invokes dictionary 1 even when the browser suppresses its click', () => {
  const click = vi.fn();
  render(
    <AnnotationToolButton
      showTooltip={false}
      tooltipText='사전'
      Icon={() => null}
      onClick={click}
      onLongPress={() => {}}
    />,
  );
  const button = screen.getByRole('button', { name: '사전' });
  fireEvent.pointerDown(button);
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(click).toHaveBeenCalledTimes(1);
});
