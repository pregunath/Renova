import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MoodboardPage from '../page';

// ─── navigation ───────────────────────────────────────────────────────────────
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockUseParams = jest.fn(() => ({ id: 'test-board-id' }));

// Return a single stable router object so `router` in useEffect deps never changes reference.
jest.mock('next/navigation', () => {
  const stableRouter = { push: (...a) => mockPush(...a), replace: (...a) => mockReplace(...a), back: (...a) => mockBack(...a) };
  return {
    useRouter: () => stableRouter,
    useParams: () => mockUseParams(),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  };
});

jest.mock('next/link', () =>
  function MockLink({ href, children }) { return <a href={href}>{children}</a>; }
);

// ─── antd ────────────────────────────────────────────────────────────────────
jest.mock('antd', () => {
  const React = require('react');
  return {
    Modal: function Modal({ open, onCancel, children, title, footer }) {
      if (!open) return null;
      return (
        <div role="dialog" aria-label={title}>
          {children}
        </div>
      );
    },
    Input: Object.assign(
      function Input({ id, value, onChange, placeholder }) {
        return <input id={id} value={value} onChange={onChange} placeholder={placeholder} />;
      },
      {
        TextArea: function TextArea(props) { return <textarea {...props} />; },
      }
    ),
    Switch: function Switch({ checked, onChange }) {
      return (
        <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
          {checked ? 'Public board' : 'Private board'}
        </button>
      );
    },
    Button: function Button({ children, onClick, disabled, loading, type, htmlType }) {
      return (
        <button type={htmlType || 'button'} onClick={onClick} disabled={disabled || loading}>
          {children}
        </button>
      );
    },
    Spin: function Spin() { return <div data-testid="spin" />; },
    message: { error: jest.fn(), success: jest.fn(), warning: jest.fn() },
  };
});

const mockMessage = require('antd').message;

jest.mock('@ant-design/icons', () => ({
  ArrowLeftOutlined: () => <span />,
}));

// ─── child component mocks ────────────────────────────────────────────────────
jest.mock('@/components/moodboard/BoardCanvas', () => {
  const React = require('react');
  return React.forwardRef(function MockBoardCanvas({ onSceneReady }, ref) {
    React.useImperativeHandle(ref, () => ({
      exportImage: jest.fn(() => 'data:image/png;base64,mock'),
      exportThumbnail: jest.fn(() => null), // null = skip thumbnail fetch
    }));
    React.useEffect(() => {
      if (onSceneReady) onSceneReady();
    }, [onSceneReady]);
    return <div data-testid="board-canvas" />;
  });
});

jest.mock('@/components/moodboard/Toolbar', () =>
  function MockToolbar() { return <div data-testid="toolbar" />; }
);

jest.mock('@/components/moodboard/Sidebar', () =>
  function MockSidebar({ moodboardId }) {
    return <div data-testid="sidebar" data-board-id={moodboardId} />;
  }
);

jest.mock('@/components/moodboard/BoardActions', () =>
  function MockBoardActions({ onAction, onFilesSelected, disabled }) {
    return (
      <div data-testid="board-actions">
        <button data-testid="action-save" onClick={() => onAction('save')} disabled={!!disabled?.save}>Save</button>
        <button data-testid="action-export" onClick={() => onAction('export')} disabled={!!disabled?.export}>Export</button>
        <button data-testid="action-bg" onClick={() => onAction('bg')} disabled={!!disabled?.bg}>BG</button>
        <button
          data-testid="action-upload"
          onClick={() => onFilesSelected?.([new File(['img'], 'test.jpg', { type: 'image/jpeg' })])}
        >
          Upload
        </button>
      </div>
    );
  }
);

jest.mock('@/contexts/boardStore', () => ({ useBoardStore: jest.fn() }));
jest.mock('@/utils/moodboardMedia', () => ({
  toMoodboardDisplaySrc: jest.fn((src) => src),
}));

// ─── globals ─────────────────────────────────────────────────────────────────
const { useBoardStore } = require('@/contexts/boardStore');

const mockSetItems = jest.fn();
const mockPushHistory = jest.fn();
const mockSetMode = jest.fn();

// window.Image: resolves onload immediately
class MockHTMLImage {
  constructor() {
    this._src = '';
  }
  set src(val) {
    this._src = val;
    Promise.resolve().then(() => { if (this.onload) this.onload(); });
  }
  get src() { return this._src; }
  get naturalWidth() { return 400; }
  get naturalHeight() { return 300; }
}

// Fetch helper: respond differently by URL/method
const makeFetch = ({
  board = { id: 'test-board-id', title: 'My Board', isPublic: true, background: '#ffffff', scene: JSON.stringify({ items: [] }) },
  list = [],
  patch = { id: 'test-board-id' },
  usage = { moodboardsUsed: 2, moodboardsLimit: 10 },
} = {}) =>
  jest.fn((url, opts = {}) => {
    const method = opts.method || 'GET';
    if (url.includes('/api/moodboard/test-board-id')) {
      if (method === 'PATCH') return Promise.resolve({ ok: true, json: async () => patch, text: async () => '' });
      return Promise.resolve({ ok: true, json: async () => board, text: async () => '' });
    }
    if (url.includes('/api/moodboard/new-board')) {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'new-board-saved' }), text: async () => '' });
    }
    if (url.includes('/api/moodboard') && method === 'POST') {
      return Promise.resolve({ ok: true, json: async () => ({ id: 'new-board-saved' }), text: async () => '' });
    }
    if (url.includes('/api/moodboard')) {
      return Promise.resolve({ ok: true, json: async () => list, text: async () => '' });
    }
    if (url.includes('/api/plans/usage')) {
      return Promise.resolve({ ok: true, json: async () => ({ usage }), text: async () => '' });
    }
    if (url.includes('/api/moodboard') && url.includes('/items')) {
      return Promise.resolve({ ok: true, json: async () => ({ src: '/media/test.jpg' }), text: async () => '' });
    }
    return Promise.resolve({ ok: true, json: async () => ({}), text: async () => '' });
  });

beforeEach(() => {
  jest.clearAllMocks();
  global.Image = MockHTMLImage;
  global.requestAnimationFrame = jest.fn((cb) => { cb(); return 1; });
  global.cancelAnimationFrame = jest.fn();
  mockUseParams.mockReturnValue({ id: 'test-board-id' });
  mockPush.mockReset();
  mockReplace.mockReset();
  localStorage.getItem.mockReturnValue('mock-token');
  useBoardStore.mockReturnValue({
    items: [],
    setItems: mockSetItems,
    pushHistory: mockPushHistory,
    setMode: mockSetMode,
  });
  global.fetch = makeFetch();
});

// ─── board loading ────────────────────────────────────────────────────────────
describe('board loading', () => {
  it('shows the board title in the project name input after load', async () => {
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('My Board');
    });
  });

  it('renders the board canvas', async () => {
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId('board-canvas')).toBeInTheDocument();
    });
  });

  it('calls setItems with parsed scene items', async () => {
    const board = {
      id: 'test-board-id',
      title: 'My Board',
      isPublic: true,
      background: '#ffffff',
      scene: JSON.stringify({ items: [{ id: 'item-1', kind: 'image', src: 'img.jpg', x: 0, y: 0, w: 100, h: 100, z: 1 }] }),
    };
    global.fetch = makeFetch({ board });
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(mockSetItems).toHaveBeenCalled();
    });
  });
});

// ─── board load failure ───────────────────────────────────────────────────────
describe('board load failure', () => {
  it('shows error message when fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Not found',
      json: async () => ({}),
    });
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('Not found');
    });
  });
});

// ─── new moodboard ────────────────────────────────────────────────────────────
describe('new moodboard', () => {
  beforeEach(() => {
    mockUseParams.mockReturnValue({ id: 'new' });
  });

  it('shows "Untitled Moodboard" for a new board', async () => {
    global.fetch = makeFetch({ usage: { moodboardsUsed: 0, moodboardsLimit: 10 } });
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('Untitled Moodboard');
    });
  });

  it('redirects when moodboard limit is reached', async () => {
    global.fetch = makeFetch({ usage: { moodboardsUsed: 10, moodboardsLimit: 10 } });
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard/moodboards?limit=1');
    });
  });
});

// ─── save modal ───────────────────────────────────────────────────────────────
describe('save modal', () => {
  it('opens when save action is triggered', async () => {
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    fireEvent.click(screen.getByTestId('action-save'));
    expect(screen.getByRole('dialog', { name: 'Save moodboard' })).toBeInTheDocument();
  });

  it('closes when Cancel button inside modal is clicked', async () => {
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    fireEvent.click(screen.getByTestId('action-save'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves existing board on form submit and shows success', async () => {
    render(<MoodboardPage />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('My Board'));
    fireEvent.click(screen.getByTestId('action-save'));
    fireEvent.submit((await screen.findByRole('dialog')).querySelector('form'));
    await waitFor(() => {
      expect(mockMessage.success).toHaveBeenCalledWith('Moodboard saved.');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled(); // not a new board
  });

  it('navigates to new board URL after saving /new', async () => {
    mockUseParams.mockReturnValue({ id: 'new' });
    global.fetch = makeFetch({ usage: { moodboardsUsed: 0, moodboardsLimit: 10 } });
    // POST to create new board
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ usage: { moodboardsUsed: 0, moodboardsLimit: 10 } }), text: async () => '' })
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'brand-new-board' }), text: async () => '' });

    render(<MoodboardPage />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('Untitled Moodboard'));
    fireEvent.click(screen.getByTestId('action-save'));
    fireEvent.submit((await screen.findByRole('dialog')).querySelector('form'));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/moodboards/brand-new-board');
    });
  });
});

// ─── background editor ────────────────────────────────────────────────────────
describe('background editor', () => {
  it('opens when bg action is triggered', async () => {
    const user = userEvent.setup();
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    await user.click(screen.getByTestId('action-bg'));
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('closes and applies color on Done', async () => {
    const user = userEvent.setup();
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    await user.click(screen.getByTestId('action-bg'));
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('closes and reverts on Cancel', async () => {
    const user = userEvent.setup();
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    await user.click(screen.getByTestId('action-bg'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('hides Toolbar while bg editor is open', async () => {
    const user = userEvent.setup();
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    await user.click(screen.getByTestId('action-bg'));
    expect(screen.queryByTestId('toolbar')).not.toBeInTheDocument();
  });
});

// ─── export ───────────────────────────────────────────────────────────────────
describe('export', () => {
  it('triggers an anchor download when export is clicked', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<MoodboardPage />);
    await waitFor(() => screen.getByRole('textbox', { name: 'Project name' }));
    fireEvent.click(screen.getByTestId('action-export'));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});

// ─── other moodboards ─────────────────────────────────────────────────────────
describe('other moodboards', () => {
  it('shows other boards and filters out the current board', async () => {
    global.fetch = makeFetch({
      list: [
        { id: 'other-1', title: 'Other Board' },
        { id: 'test-board-id', title: 'Current' },
      ],
    });
    render(<MoodboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Other Board')).toBeInTheDocument();
    });
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
  });
});

// ─── autosave ─────────────────────────────────────────────────────────────────
describe('autosave', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires a PATCH after the debounce when state differs from saved snapshot', async () => {
    jest.useFakeTimers();
    global.requestAnimationFrame = jest.fn((cb) => { cb(); return 1; });
    render(<MoodboardPage />);

    // Flush promises so board loads (RAF runs immediately via our mock)
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-board-id' }),
      text: async () => '',
    });
    global.fetch = fetchSpy;

    // Open save modal, change title (this calls setProjectName which drives autosave),
    // then cancel (no server save, but local state changes)
    fireEvent.click(screen.getByTestId('action-save'));
    const nameInput = document.getElementById('project-name-input');
    if (nameInput) {
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Advance past debounce and flush the async saveBoardPatch fetch
    act(() => { jest.advanceTimersByTime(3500); });
    await act(async () => { await Promise.resolve(); });

    const patchCalls = fetchSpy.mock.calls.filter(
      ([url, opts]) => opts?.method === 'PATCH' && url?.includes('test-board-id')
    );
    expect(patchCalls.length).toBeGreaterThan(0);
  });

  it('does not fire autosave when moodboardId is "new"', async () => {
    mockUseParams.mockReturnValue({ id: 'new' });
    jest.useFakeTimers();
    global.requestAnimationFrame = jest.fn((cb) => { cb(); return 1; });

    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ usage: { moodboardsUsed: 0, moodboardsLimit: 10 } }),
      text: async () => '',
    });
    global.fetch = fetchSpy;

    render(<MoodboardPage />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    act(() => { jest.advanceTimersByTime(3500); });
    await act(async () => { await Promise.resolve(); });

    const patchCalls = fetchSpy.mock.calls.filter(([, opts]) => opts?.method === 'PATCH');
    expect(patchCalls).toHaveLength(0);
  });
});

// ─── image upload ─────────────────────────────────────────────────────────────
describe('image upload', () => {
  it('calls setItems after a successful image upload', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'test-board-id', title: 'My Board', isPublic: true, background: '#ffffff', scene: '{"items":[]}' }), text: async () => '' })
      .mockResolvedValue({ ok: true, json: async () => ({ src: '/media/test.jpg' }), text: async () => '' });

    render(<MoodboardPage />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('My Board'));

    const initialCalls = mockSetItems.mock.calls.length;
    fireEvent.click(screen.getByTestId('action-upload'));

    await waitFor(() => {
      expect(mockSetItems.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
