import {
  Reducer,
  ReducerWithoutAction,
  useMemo,
  useReducer,
  useRef,
  SetStateAction,
} from "react";

const StackEmptyValue = Symbol();

class Stack<T> {
  private constructor(private __list: T[]) {}
  static createEmpty = <S>() => new Stack<S>([]);

  push(item: T): Stack<T> {
    return new Stack([...this.__list, item]);
  }

  pop(): Stack<T> {
    if (this.__list.length === 0) return this;
    return new Stack(this.__list.slice(0, -1));
  }

  first(): T | typeof StackEmptyValue {
    if (this.__list.length === 0) return StackEmptyValue;
    else return this.__list[this.__list.length - 1];
  }

  canPop(): boolean {
    return this.__list.length !== 0;
  }
}

type UndoState<T> = {
  undoStack: Stack<T>;
  redoStack: Stack<T>;
  currentState: T;
};

type Action<T> =
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set"; setStateAction: SetStateAction<T> }
  | { type: "push"; setStateAction: SetStateAction<T> };

const undoReducer = <T>(
  prevState: UndoState<T>,
  action: Action<T>,
): UndoState<T> => {
  switch (action.type) {
    case "set": {
      return {
        undoStack: prevState.undoStack,
        redoStack: Stack.createEmpty(),
        currentState:
          typeof action.setStateAction === "function"
            ? // @ts-expect-error Consider action.setStateAction to be a function
              action.setStateAction(prevState.currentState)
            : action.setStateAction,
      };
    }
    case "push": {
      return {
        undoStack: prevState.undoStack.push(prevState.currentState),
        redoStack: Stack.createEmpty(),
        currentState:
          typeof action.setStateAction === "function"
            ? // @ts-expect-error Consider action.setStateAction to be a function
              action.setStateAction(prevState.currentState)
            : action.setStateAction,
      };
    }
    case "undo": {
      const currentState = prevState.undoStack.first();
      if (currentState === StackEmptyValue) return prevState;

      return {
        undoStack: prevState.undoStack.pop(),
        redoStack: prevState.redoStack.push(prevState.currentState),
        currentState: currentState,
      };
    }
    case "redo": {
      const currentState = prevState.redoStack.first();
      if (currentState === StackEmptyValue) return prevState;

      return {
        undoStack: prevState.undoStack.push(prevState.currentState),
        redoStack: prevState.redoStack.pop(),
        currentState: currentState,
      };
    }
  }
};

export function useUndoState<T>(initialState: T): readonly [
  { currentState: T; canUndo: boolean; canRedo: boolean },
  {
    readonly undo: () => void;
    readonly redo: () => void;
    readonly setState: (
      type: "set" | "push",
      setStateAction: SetStateAction<T>,
    ) => void;
  },
] {
  const [undoState, dispatch] = useReducer<Reducer<UndoState<T>, Action<T>>>(
    undoReducer,
    {
      undoStack: Stack.createEmpty(),
      redoStack: Stack.createEmpty(),
      currentState: initialState,
    },
  );

  const mutater = useMemo(
    () =>
      ({
        undo: () => dispatch({ type: "undo" }),
        redo: () => dispatch({ type: "redo" }),
        setState: (type: "set" | "push", setStateAction: SetStateAction<T>) =>
          dispatch({ type: type, setStateAction }),
      } as const),
    [],
  );

  const state = useMemo(
    () => ({
      currentState: undoState.currentState,
      canUndo: undoState.undoStack.canPop(),
      canRedo: undoState.redoStack.canPop(),
    }),
    [undoState],
  );

  return [state, mutater] as const;
}

export function useUndoReducer<S>(
  reducer: ReducerWithoutAction<S>,
  initialState: S,
): readonly [
  { currentState: S; canUndo: boolean; canRedo: boolean },
  {
    readonly undo: () => void;
    readonly redo: () => void;
    readonly dispatch: (type: "set" | "push") => void;
  },
];
export function useUndoReducer<S, A>(
  reducer: Reducer<S, A>,
  initialState: S,
): readonly [
  { currentState: S; canUndo: boolean; canRedo: boolean },
  {
    readonly undo: () => void;
    readonly redo: () => void;
    readonly dispatch: (type: "set" | "push", action: A) => void;
  },
];
export function useUndoReducer<S, A>(
  reducer: Reducer<S, A>,
  initialState: S,
): readonly [
  { currentState: S; canUndo: boolean; canRedo: boolean },
  {
    readonly undo: () => void;
    readonly redo: () => void;
    readonly dispatch: (type: "set" | "push", action: A) => void;
  },
] {
  const reducerRef = useRef(reducer);

  const [state, mutater] = useUndoState(initialState);

  const reducerMutater = useMemo(
    () =>
      ({
        undo: mutater.undo,
        redo: mutater.redo,
        dispatch: (type: "set" | "push", action: A) =>
          mutater.setState(type, prevState =>
            reducerRef.current(prevState, action),
          ),
      } as const),
    [mutater],
  );

  return [state, reducerMutater] as const;
}
