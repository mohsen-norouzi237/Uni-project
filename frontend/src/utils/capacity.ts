/**
 * The single definition of "at capacity" in the app.
 *
 * Both the workload filter (`isOverloaded`) and the visual `CapacityBar`
 * badge used to answer this question on their own, and they disagreed: the
 * service used `current >= Math.max(0, max)`, which marks a TA with a limit of
 * 0 and ZERO assigned courses as overloaded, while the bar used
 * `max === 0 ? current > 0 : current >= max`. One function, one answer.
 *
 * A limit of 0 means "no allowance", so it is only exceeded once at least one
 * course has actually been assigned. Non-finite input is coerced to 0.
 */
export const isAtCapacity = (current: number, max: number): boolean => {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeMax = Number.isFinite(max) ? Math.max(0, max) : 0;

  return safeMax === 0 ? safeCurrent > 0 : safeCurrent >= safeMax;
};
