import { useCallback, useEffect, useRef, useState } from 'react';

export const DEFAULT_PENDING_COMMAND_TIMEOUT_MS = 5_000;

export type PendingCommandState<TSnapshot> = {
  id: string;
  label: string;
  startedAt: number;
  expiresAt: number;
  snapshot: TSnapshot;
};

type PendingCommandRecord<TSnapshot> = PendingCommandState<TSnapshot> & {
  onTimeout: (command: PendingCommandState<TSnapshot>) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type StartPendingCommandInput<TSnapshot> = {
  id: string;
  label: string;
  snapshot: TSnapshot;
  timeoutMs?: number;
  onTimeout: (command: PendingCommandState<TSnapshot>) => void;
};

type ResolvePendingCommandOptions<TSnapshot> = {
  onResolve?: (command: PendingCommandState<TSnapshot>) => void;
};

export function usePendingCommand<TSnapshot>() {
  const commandsRef = useRef<Map<string, PendingCommandRecord<TSnapshot>>>(new Map());
  const [commands, setCommands] = useState<Record<string, PendingCommandState<TSnapshot>>>({});

  const removeCommand = useCallback((id: string) => {
    setCommands((current) => {
      if (!current[id]) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const resolveCommand = useCallback(
    (id: string, options?: ResolvePendingCommandOptions<TSnapshot>) => {
      const command = commandsRef.current.get(id);

      if (!command) {
        return null;
      }

      clearTimeout(command.timeoutId);
      commandsRef.current.delete(id);
      removeCommand(id);

      const resolvedCommand: PendingCommandState<TSnapshot> = {
        id: command.id,
        label: command.label,
        startedAt: command.startedAt,
        expiresAt: command.expiresAt,
        snapshot: command.snapshot,
      };

      options?.onResolve?.(resolvedCommand);
      return resolvedCommand;
    },
    [removeCommand]
  );

  const startCommand = useCallback(
    (input: StartPendingCommandInput<TSnapshot>) => {
      if (commandsRef.current.has(input.id)) {
        return null;
      }

      const timeoutMs = input.timeoutMs ?? DEFAULT_PENDING_COMMAND_TIMEOUT_MS;
      const startedAt = Date.now();
      const commandState: PendingCommandState<TSnapshot> = {
        id: input.id,
        label: input.label,
        startedAt,
        expiresAt: startedAt + timeoutMs,
        snapshot: input.snapshot,
      };

      const timeoutId = setTimeout(() => {
        const activeCommand = commandsRef.current.get(input.id);

        if (!activeCommand || activeCommand.startedAt !== startedAt) {
          return;
        }

        commandsRef.current.delete(input.id);
        removeCommand(input.id);
        activeCommand.onTimeout({
          id: activeCommand.id,
          label: activeCommand.label,
          startedAt: activeCommand.startedAt,
          expiresAt: activeCommand.expiresAt,
          snapshot: activeCommand.snapshot,
        });
      }, timeoutMs);

      commandsRef.current.set(input.id, {
        ...commandState,
        onTimeout: input.onTimeout,
        timeoutId,
      });
      setCommands((current) => ({
        ...current,
        [input.id]: commandState,
      }));

      return commandState;
    },
    [removeCommand]
  );

  const resolveAllCommands = useCallback(
    (options?: ResolvePendingCommandOptions<TSnapshot>) => {
      const commandsToResolve = Array.from(commandsRef.current.values());

      commandsToResolve.forEach((command) => {
        clearTimeout(command.timeoutId);
        commandsRef.current.delete(command.id);
      });
      setCommands({});

      const resolvedCommands = commandsToResolve.map<PendingCommandState<TSnapshot>>((command) => ({
        id: command.id,
        label: command.label,
        startedAt: command.startedAt,
        expiresAt: command.expiresAt,
        snapshot: command.snapshot,
      }));

      resolvedCommands.forEach((command) => options?.onResolve?.(command));
      return resolvedCommands;
    },
    []
  );

  const isPending = useCallback((id: string) => commandsRef.current.has(id), []);

  useEffect(() => {
    return () => {
      commandsRef.current.forEach((command) => clearTimeout(command.timeoutId));
      commandsRef.current.clear();
    };
  }, []);

  return {
    commands,
    isPending,
    resolveAllCommands,
    resolveCommand,
    startCommand,
  };
}
