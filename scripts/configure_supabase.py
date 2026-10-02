"""Interactive local setup; no PowerShell execution-policy change required."""
from datetime import datetime
from getpass import getpass
from pathlib import Path
from shutil import copy2
from urllib.parse import quote, urlsplit
import sys


def main():
    root = Path(__file__).resolve().parent.parent
    env_file = root / 'backend' / '.env'
    if not env_file.is_file():
        raise ValueError('backend/.env is missing. Copy backend/.env.example first.')
    template = input('Paste Session pooler URI with [YOUR-PASSWORD] still in it: ').strip()
    if template.count('[YOUR-PASSWORD]') != 1:
        raise ValueError('Use the URI with one [YOUR-PASSWORD] placeholder. Enter the password at the next hidden prompt.')
    uri = urlsplit(template.replace('[YOUR-PASSWORD]', 'placeholder'))
    if (uri.scheme not in ('postgres', 'postgresql')
        or not (uri.hostname or '').endswith('.pooler.supabase.com')
        or uri.port != 5432 or uri.path != '/postgres'
        or uri.query or uri.fragment or not uri.username):
        raise ValueError('Expected Session pooler URI, port 5432, database postgres, without query parameters.')
    if not sys.stdin.isatty():
        raise ValueError('Run this script in an interactive terminal so the password can be hidden.')
    password = getpass('Database password (hidden): ')
    if not password:
        raise ValueError('Password cannot be empty.')
    connection = template.replace('[YOUR-PASSWORD]', quote(password, safe=''))
    password = None
    lines = env_file.read_text(encoding='utf-8-sig').splitlines()
    backup_dir = root / 'tmp' / 'supabase-setup'
    backup_dir.mkdir(parents=True, exist_ok=True)
    copy2(env_file, backup_dir / f'backend.env.before-supabase-{datetime.now():%Y%m%d-%H%M%S-%f}.txt')
    values = {'DATABASE_URL': connection, 'DATABASE_SSL': 'true'}
    updated = []
    for line in lines:
        key = line.split('=', 1)[0]
        if key in values:
            updated.append(f'{key}={values.pop(key)}')
        else:
            updated.append(line)
    updated.extend(f'{key}={value}' for key, value in values.items())
    env_file.write_text('\n'.join(updated) + '\n', encoding='utf-8')
    print('Saved backend/.env with Supabase connection and TLS enabled.')
    print('TEST_DATABASE_URL and PUBLIC_BASE_URL are unchanged. Previous settings are backed up under tmp/supabase-setup.')
    print('Connection and migration have not been tested yet.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError):
        # Avoid printing exceptions that could contain a malformed credential URI.
        print('Setup failed: check the placeholder URI, interactive terminal and file permissions.', file=sys.stderr)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print('\nSetup cancelled. No connection details printed.', file=sys.stderr)
        sys.exit(1)
