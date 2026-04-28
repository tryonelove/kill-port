import { List, ActionPanel, Action, showHUD, showToast, Toast } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useState, useMemo } from "react";
import { execSync } from "child_process";

interface PortProcess {
  pid: string;
  name: string;
  command: string;
}

function parseProcesses(lsofOutput: string, pids: string[]): PortProcess[] {
  if (pids.length === 0) return [];

  const nameMap = new Map<string, string>();
  for (const line of lsofOutput.trim().split("\n").slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const pid = parts[1];
    if (!nameMap.has(pid)) nameMap.set(pid, parts[0]);
  }

  const commandMap = new Map<string, string>();
  try {
    const psOutput = execSync(`/bin/ps -p ${pids.join(",")} -o pid=,args=`, { encoding: "utf-8" });
    for (const line of psOutput.trim().split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match) commandMap.set(match[1], match[2]);
    }
  } catch {
    // ignore — fallback to lsof name
  }

  return pids.map((pid) => ({
    pid,
    name: nameMap.get(pid) ?? pid,
    command: commandMap.get(pid) ?? nameMap.get(pid) ?? pid,
  }));
}

function isValidPort(input: string): boolean {
  const num = parseInt(input, 10);
  return /^\d+$/.test(input) && num >= 1 && num <= 65535;
}

interface EmptyViewProps {
  portInput: string;
  valid: boolean;
  isLoading: boolean;
}

function EmptyView({ portInput, valid, isLoading }: EmptyViewProps) {
  if (!portInput) {
    return <List.EmptyView title="Enter a port number" />;
  }
  if (!valid) {
    return <List.EmptyView title="Invalid port" description="Enter a number between 1 and 65535" />;
  }
  if (!isLoading) {
    return <List.EmptyView title={`No processes on port ${portInput}`} />;
  }

  return null;
}

export default function KillPort() {
  const [portInput, setPortInput] = useState("");

  const valid = isValidPort(portInput);

  const {
    data: lsofOutput,
    isLoading,
    mutate,
  } = useExec("/usr/sbin/lsof", ["-i", `:${portInput}`, "-n", "-P", "-sTCP:LISTEN"], {
    execute: valid,
    keepPreviousData: false,
    parseOutput: ({ stdout, exitCode }) => (exitCode === 1 ? "" : stdout),
  });

  const processes = useMemo<PortProcess[]>(() => {
    if (!lsofOutput) return [];
    const seen = new Set<string>();
    const pids: string[] = [];
    for (const line of lsofOutput.trim().split("\n").slice(1)) {
      const pid = line.trim().split(/\s+/)[1];
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        pids.push(pid);
      }
    }
    return parseProcesses(lsofOutput, pids);
  }, [lsofOutput]);

  async function killProcess(pid: string, name: string) {
    try {
      await mutate(
        new Promise<void>((resolve, reject) => {
          try {
            execSync(`kill -9 ${pid}`);
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
        {
          optimisticUpdate(current) {
            if (!current) return current;
            return current
              .split("\n")
              .filter((line, i) => i === 0 || line.trim().split(/\s+/)[1] !== pid)
              .join("\n");
          },
        },
      );
      const remaining = processes.filter((p) => p.pid !== pid);
      if (remaining.length === 0) {
        await showHUD(`Killed ${name} (${pid})`);
      } else {
        await showToast({ style: Toast.Style.Success, title: `Killed ${name} (${pid})` });
      }
    } catch (e: unknown) {
      const msg = String(e);
      await showToast({
        style: Toast.Style.Failure,
        title: msg.includes("Operation not permitted") ? "Permission denied — try sudo" : "Failed to kill process",
        message: msg,
      });
    }
  }

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Enter port..."
      onSearchTextChange={setPortInput}
      filtering={false}
    >
      {processes.length === 0 ? (
        <EmptyView portInput={portInput} valid={valid} isLoading={isLoading} />
      ) : (
        processes.map((proc) => (
          <List.Item
            key={proc.pid}
            title={`${proc.name} (${proc.pid})`}
            subtitle={proc.command}
            actions={
              <ActionPanel>
                <Action title="Kill Process" onAction={() => killProcess(proc.pid, proc.name)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
