import { RatingQueue } from '../ratingQueue';

type Save = jest.Mock<Promise<void>, [number, number | null]>;

function setup(save: Save) {
  const onSaved = jest.fn();
  const onFailed = jest.fn();
  const queue = new RatingQueue<number>({ delayMs: 400, save, equals: (a, b) => a === b, onSaved, onFailed });
  return { queue, onSaved, onFailed };
}

/** Let queued promise callbacks run (fake timers don't flush microtasks). */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RatingQueue', () => {
  it('collapses rapid changes into one save of the latest value', async () => {
    const save: Save = jest.fn().mockResolvedValue(undefined);
    const { queue, onSaved } = setup(save);
    queue.set(7, 60, null);
    queue.set(7, 80, 60);
    queue.set(7, 90, 80);
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(400);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(7, 90);
    expect(onSaved).toHaveBeenCalledWith(7, 90);
  });

  it('skips the request when the value ends where it started', async () => {
    const save: Save = jest.fn().mockResolvedValue(undefined);
    const { queue } = setup(save);
    queue.set(7, 60, 50);
    queue.set(7, 50, 60); // tapped back to the saved value
    jest.advanceTimersByTime(400);
    await settle();
    expect(save).not.toHaveBeenCalled();
  });

  it('clears are saved like any other change', async () => {
    const save: Save = jest.fn().mockResolvedValue(undefined);
    const { queue } = setup(save);
    queue.set(7, null, 80);
    await queue.flush(7);
    expect(save).toHaveBeenCalledWith(7, null);
  });

  it('never runs two saves for the same game at once (latest wins, in order)', async () => {
    let release!: () => void;
    const save: Save = jest
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockResolvedValue(undefined);
    const { queue } = setup(save);
    queue.set(7, 60, null);
    const first = queue.flush(7);
    await settle();
    queue.set(7, 90, 60); // while the first save is in flight
    const second = queue.flush(7);
    await settle();
    expect(save).toHaveBeenCalledTimes(1); // second waits for the first
    release();
    await first;
    await second;
    expect(save.mock.calls).toEqual([
      [7, 60],
      [7, 90],
    ]);
  });

  it('a failed save reports the server value so the UI can roll back', async () => {
    const save: Save = jest.fn().mockRejectedValue(new Error('offline'));
    const { queue, onFailed, onSaved } = setup(save);
    queue.set(7, 90, 40);
    await queue.flush(7);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledWith(7, 40, expect.objectContaining({ message: 'offline' }));
    expect(queue.isBusy(7)).toBe(false);
  });

  it('games are independent', async () => {
    const save: Save = jest.fn().mockResolvedValue(undefined);
    const { queue } = setup(save);
    queue.set(1, 10, null);
    queue.set(2, 20, null);
    await queue.flushAll();
    expect(save.mock.calls).toEqual([
      [1, 10],
      [2, 20],
    ]);
  });
});
