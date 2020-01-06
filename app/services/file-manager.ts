import { Service } from 'services/core/service';
import path from 'path';
import fs from 'fs';

interface IFile {
  data: string;
  locked: boolean;
  version: number;
  dirty: boolean;

  /**
   * Used during shutdown to coordinate flushing fully finished
   * before shutting down.
   */
  flushFinished?: () => void;
}

export interface IFileReadOptions {
  // If true, will attempt to validate that valid
  // JSON was read, and will retry/fail if not.
  validateJSON?: boolean;

  // The number of times to retry
  retries?: number;
}

/**
 * This service provides an atomic, race-condition-free
 * file I/O system.  It supports instaneous synchronous
 * reads and writes of files under management.  It does
 * this by storing a copy of all files in memory, and
 * asynchronously flushing them to disk.  This obviously
 * has the downside of being memory intensive, and should
 * only be used for small files where atomicity and
 * performance are important.
 */
export class FileManagerService extends Service {
  private files: Dictionary<IFile> = {};

  async exists(filePath: string): Promise<boolean> {
    const truePath = path.resolve(filePath);

    if (this.files[truePath]) return Promise.resolve(true);
    return this.fileExists(truePath);
  }

  write(filePath: string, data: string) {
    const truePath = path.resolve(filePath);
    const file = this.files[truePath];

    if (file) {
      file.data = data;
      file.version += 1;
      file.dirty = true;
    } else {
      this.files[truePath] = {
        data,
        locked: false,
        version: 0,
        dirty: true,
      };
    }

    this.flush(truePath);
  }

  read(filePath: string, options: IFileReadOptions = {}): string {
    const truePath = path.resolve(filePath);
    let file = this.files[truePath];

    const opts = {
      validateJSON: false,
      retries: 0,
      ...options,
    };

    // If this is the first read of this file, do a blocking synchronous read
    if (!file) {
      let data: string;

      try {
        data = fs.readFileSync(truePath).toString();

        if (opts.validateJSON) {
          JSON.parse(data);
        }
      } catch (e) {
        if (opts.retries > 0) {
          this.read(filePath, {
            ...opts,
            retries: opts.retries - 1,
          });
        } else {
          throw e;
        }
      }

      file = this.files[truePath] = {
        data,
        locked: false,
        version: 0,
        dirty: false,
      };
    }

    return file.data;
  }

  copy(sourcePath: string, destPath: string) {
    const trueSource = path.resolve(sourcePath);
    const trueDest = path.resolve(destPath);

    this.files[trueDest] = {
      data: this.read(trueSource),
      locked: false,
      version: 0,
      dirty: true,
    };

    this.flush(trueDest);
  }

  /**
   * Ensures that all dirty files have been flushed.  Should only
   * be called before shutdown.
   */
  async flushAll() {
    const promises = Object.values(this.files)
      .filter(file => file.dirty)
      .map(file => {
        return new Promise(resolve => {
          file.flushFinished = resolve;
        });
      });

    await Promise.all(promises);
  }

  private async flush(filePath: string, tries = 10) {
    const file = this.files[filePath];

    // Current flush attempt will realize it wrote out
    // of date data and re-run.
    if (file.locked) return;

    file.locked = true;
    const version = file.version;

    try {
      await this.writeFile(filePath, file.data);

      if (version !== file.version) {
        throw new Error('Wrote out of date file!  Will retry...');
      }

      file.locked = false;
      file.dirty = false;
      if (file.flushFinished) file.flushFinished();
      console.debug(`Wrote file ${filePath} version ${version}`);
    } catch (e) {
      if (tries > 0) {
        file.locked = false;
        await this.flush(filePath, tries - 1);
      } else {
        if (file.flushFinished) file.flushFinished();
        console.error(`Ran out of retries writing ${filePath}`);
      }
    }
  }

  /**
   * Checks if a file exists
   * @param filePath a path to the file
   */
  private fileExists(filePath: string): Promise<boolean> {
    return new Promise(resolve => {
      fs.exists(filePath, exists => resolve(exists));
    });
  }

  /**
   * Writes data to a file atomically
   * @param filePath a path to the file
   * @param data The data to write
   */
  private writeFile(filePath: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tmpPath = `${filePath}.tmp`;

      fs.writeFile(tmpPath, data, err => {
        if (err) {
          reject(err);
          return;
        }

        fs.rename(tmpPath, filePath, err => {
          if (err) {
            reject(err);
            return;
          }

          resolve();
        });
      });
    });
  }
}
