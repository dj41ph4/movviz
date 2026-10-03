/** Wait for the old client to really exit before rebinding its ports. */
export async function stopClientProcess(child, requestShutdown, graceMs = 2000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  let exited = false;
  let resolveExit;
  const exit = new Promise((resolve) => { resolveExit = resolve; });
  const onExit = () => { exited = true; resolveExit(); };
  child.once("exit", onExit);
  const wait = async (ms) => {
    let timer;
    await Promise.race([exit, new Promise((resolve) => { timer = setTimeout(resolve, ms); })]);
    clearTimeout(timer);
  };
  try {
    Promise.resolve().then(requestShutdown).catch(() => {});
    await wait(graceMs);
    if (!exited) {
      child.kill(process.platform === "win32" ? undefined : "SIGKILL");
      await wait(5000);
    }
    if (!exited) throw new Error("Torrent client process did not stop");
  } finally {
    child.removeListener("exit", onExit);
  }
}
