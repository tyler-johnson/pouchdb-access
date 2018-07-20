/// <reference types="pouchdb-core" />
/// <reference types="pouchdb-security-helper" />

declare namespace PouchDB {
  namespace Access {
    type Listener = (...args: any[]) => void;

    interface EventEmitter {
      setMaxListeners(n: number): this;
      emit(type: string | number, ...args: any[]): boolean;
      addListener(type: string | number, listener: Listener): this;
      on(type: string | number, listener: Listener): this;
      once(type: string | number, listener: Listener): this;
      removeListener(type: string | number, listener: Listener): this;
      removeAllListeners(type?: string | number): this;
      listeners(type: string | number): Listener[];
      listenerCount(type: string | number): number;
    }

    type UserCtx = SecurityHelper.UserDocument | string | null | undefined;

    interface Level {
      name: string;
      sec: SecurityHelper.SecurityLevel;
    }

    interface LevelJSON {
      name: string;
      sec: SecurityHelper.SecurityLevelDocument;
    }

    interface hasAccess {
      (
        secObj?: SecurityHelper.SecurityLevel | Partial<SecurityHelper.SecurityLevelDocument>,
        userCtx?: SecurityHelper.UserDocument | null
      ): boolean;
    }

    interface getLevel {
      (levels: Array<Level | LevelJSON>, userCtx?: UserCtx): string | null;
    }

    interface hasLevel {
      (levels: Array<Level | LevelJSON>, userCtx: UserCtx, level: string): boolean;
    }

    interface AccessJSON {
      private: boolean;
      levels: LevelJSON[];
    }

    type Sync = (ops: object[]) => Promise<any>;

    interface AccessOptions {
      sync?: Sync;
      [key: string]: any;
    }

    interface AccessClass {
      new(db: PouchDB.Database | Access, design?: object, opts?: AccessOptions): Access;
      getLevel: getLevel;
      hasLevel: hasLevel;
      hasAccess: hasAccess;
      sync(ops: object[]): Promise<void>;
    }

    interface Access extends EventEmitter {
      options: AccessOptions;
      sync: Sync;
      design: object | undefined;
      levels: Level[];
      private: boolean;
      public: boolean;

      reset(design?: object): this;
      setDesign(doc?: object | Access): this;
      fetch(): Promise<this>;
      getLevel(userCtx?: UserCtx): string | null;
      hasLevel(userCtx: UserCtx, level: string): boolean;
      toJSON(): AccessJSON;
      toDesign(): object;
      transform(opts: object): Transform;
    }

    interface TransformOptions {
      sync?: Sync;
      [key: string]: any;
    }

    interface TransformClass {
      new(access: Access, opts?: TransformOptions): Transform;
    }

    interface Transform extends EventEmitter {
      access: Access;
      options: TransformOptions;
      sync: Sync;
      operations: object[];

      addLevel(name: string | string[], before?: string): this;
      removeLevel(name: string | string[]): this;
      setLevel(list: "name" | "role", item: string | string[], level: string | null): this;
      setLevel(list: "name" | "role", item: { [key: string]: string | string[] }): this;
      setNameLevel(name: string | string[], level: string | null): this;
      setNameLevel(name: { [key: string]: string | string[] }): this;
      setRoleLevel(role: string | string[], level: string | null): this;
      setRoleLevel(role: { [key: string]: string | string[] }): this;
      setPrivate(): this;
      setPublic(): this;
      filter(name: string, fn: (doc: any, params: any) => any): this;
      validate(name: string, fn: (newDoc: any, oldDoc: any, userCtx: any, secObj: any) => any): this;
      push(optype: string, type: string, value: object): this;
      saving(): boolean;
      delayedSave(ms?: number): Promise<void>;
      save(): Promise<void>;
    }
  }

  interface Database<Content extends {} = {}> {
    Access: Access.AccessClass;
    access(design?: object, opts?: Access.AccessOptions): Access.Access;
  }
}

declare module "pouchdb-access" {
  const Plugin: PouchDB.Plugin;
  export = Plugin;
}
