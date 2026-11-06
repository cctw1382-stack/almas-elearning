const storageKey = 'almas-demo-v1';

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

export class LocalPersistence {
  #storage: StoragePort | null = null;
  warning = '';

  load(resolveStorage: () => StoragePort, validate: (value: unknown) => void): unknown {
    try {
      this.#storage = resolveStorage();
      const saved = this.#storage.getItem(storageKey);
      if (saved === null) return undefined;
      const value: unknown = JSON.parse(saved);
      validate(value);
      return value;
    } catch {
      this.#storage = null;
      this.warning = 'تعذر قراءة التخزين المحلي أو كانت بياناته تالفة. التغييرات محفوظة لهذه الجلسة فقط.';
      return undefined;
    }
  }

  save(value: unknown): void {
    if (!this.#storage) return;
    try {
      this.#storage.setItem(storageKey, JSON.stringify(value));
    } catch {
      this.#storage = null;
      this.warning = 'تعذر حفظ التخزين المحلي. التغييرات محفوظة لهذه الجلسة فقط.';
    }
  }
}
