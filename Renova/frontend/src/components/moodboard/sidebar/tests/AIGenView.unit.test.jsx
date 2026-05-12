import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import AIGenView from '../AIGenView';

// ─── antd mock ───────────────────────────────────────────────────────────────
jest.mock('antd', () => {
  const React = require('react');
  return {
    Upload: {
      Dragger: function Dragger({ children, onChange, disabled, fileList }) {
        return (
          <div data-testid="dragger">
            {children}
            <input
              data-testid="dragger-file-input"
              type="file"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file && onChange) {
                  onChange({
                    file: {
                      originFileObj: file,
                      name: file.name,
                      uid: 'test-uid',
                      status: 'done',
                    },
                  });
                }
              }}
            />
          </div>
        );
      },
    },
    Input: Object.assign(
      function Input(props) { return <input {...props} />; },
      {
        TextArea: function TextArea({ value, onChange, placeholder, disabled, rows, onKeyDown }) {
          return (
            <textarea
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
              onKeyDown={onKeyDown}
            />
          );
        },
      }
    ),
    Button: function Button({ children, onClick, disabled, style }) {
      return (
        <button onClick={onClick} disabled={disabled} style={style}>
          {children}
        </button>
      );
    },
    Modal: function Modal({ open, onOk, onCancel, children, title, okText, cancelText }) {
      if (!open) return null;
      return (
        <div role="dialog" aria-label={title}>
          {children}
          <button data-testid="modal-ok" onClick={onOk}>{okText || 'OK'}</button>
          <button data-testid="modal-cancel" onClick={onCancel}>{cancelText || 'Cancel'}</button>
        </div>
      );
    },
    Tooltip: function Tooltip({ children }) { return <>{children}</>; },
    Spin: function Spin() { return <div data-testid="spin" />; },
    Image: function AntImage({ preview }) {
      if (preview?.visible && preview?.src) {
        return <img data-testid="ant-preview-img" src={preview.src} alt="preview" />;
      }
      return null;
    },
    message: { error: jest.fn(), success: jest.fn(), warning: jest.fn() },
  };
});

const mockMessage = require('antd').message;

jest.mock('next/link', () =>
  function MockLink({ href, children, className }) {
    return <a href={href} className={className}>{children}</a>;
  }
);

jest.mock('@/contexts/boardStore', () => ({ useBoardStore: jest.fn() }));
jest.mock('@/utils/moodboardMedia', () => ({
  toMoodboardDisplaySrc: jest.fn((src) => src),
}));

// ─── helpers ─────────────────────────────────────────────────────────────────
const { useBoardStore } = require('@/contexts/boardStore');

const usageOk = (overrides = {}) => ({
  ok: true,
  json: async () => ({
    usage: {
      generationsLimit: 10,
      generationsUsed: 3,
      bankedGenerationsRemaining: 0,
      ...overrides,
    },
  }),
  text: async () => '',
});

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch.mockReset();
  useBoardStore.mockReturnValue({ items: [] });
  global.fetch.mockResolvedValue(usageOk());
});

// ─── rendering ───────────────────────────────────────────────────────────────
describe('rendering', () => {
  it('select items button is disabled when board has no image items', async () => {
    render(<AIGenView moodboardId="board-1" />);
    expect(screen.getByRole('button', { name: /\+ Select Items/i })).toBeDisabled();
  });

  it('select items button is enabled when board has image items', async () => {
    useBoardStore.mockReturnValue({
      items: [{ id: 'img-1', src: 'http://example.com/img.jpg' }],
    });
    render(<AIGenView moodboardId="board-1" />);
    expect(screen.getByRole('button', { name: /\+ Select Items/i })).not.toBeDisabled();
  });

  it('shows upload placeholder text by default', () => {
    render(<AIGenView moodboardId="board-1" />);
    expect(screen.getByText(/Drop an image here/i)).toBeInTheDocument();
  });

  it('shows prompt textarea', () => {
    render(<AIGenView moodboardId="board-1" />);
    expect(screen.getByPlaceholderText(/Direct the AI's design choices/i)).toBeInTheDocument();
  });
});

// ─── state reset on moodboardId change ───────────────────────────────────────
describe('state reset on moodboardId change', () => {
  it('clears the prompt when moodboardId changes', async () => {
    const { rerender } = render(<AIGenView moodboardId="board-1" />);
    const textarea = screen.getByPlaceholderText(/Direct the AI's design choices/i);
    fireEvent.change(textarea, { target: { value: 'my prompt text' } });
    expect(textarea.value).toBe('my prompt text');

    rerender(<AIGenView moodboardId="board-2" />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Direct the AI's design choices/i).value).toBe('');
    });
  });
});

// ─── select items modal ───────────────────────────────────────────────────────
describe('select items modal', () => {
  const imageItems = [
    { id: 'img-1', src: 'http://example.com/img1.jpg' },
    { id: 'img-2', src: 'http://example.com/img2.jpg' },
  ];

  beforeEach(() => {
    useBoardStore.mockReturnValue({ items: imageItems });
  });

  it('opens modal when "+ Select Items" is clicked', () => {
    render(<AIGenView moodboardId="board-1" />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes modal on Cancel', () => {
    render(<AIGenView moodboardId="board-1" />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-cancel'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms selection and closes modal', () => {
    render(<AIGenView moodboardId="board-1" />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    // click first item in modal (they are buttons wrapping images)
    const dialog = screen.getByRole('dialog');
    const modalItemBtns = within(dialog).getAllByRole('button').filter(
      btn => !btn.dataset.testid
    );
    fireEvent.click(modalItemBtns[0]);
    fireEvent.click(screen.getByTestId('modal-ok'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // selected item shows Remove button
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('shows max-items warning when more than 5 items selected', () => {
    const manyItems = Array.from({ length: 6 }, (_, i) => ({
      id: `img-${i}`,
      src: `http://example.com/img${i}.jpg`,
    }));
    useBoardStore.mockReturnValue({ items: manyItems });
    render(<AIGenView moodboardId="board-1" />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    const dialog = screen.getByRole('dialog');
    const itemBtns = within(dialog).getAllByRole('button').filter(btn => !btn.dataset.testid);
    // click 5 items
    for (let i = 0; i < 5; i++) fireEvent.click(itemBtns[i]);
    // try 6th
    fireEvent.click(itemBtns[5]);
    expect(screen.getByText(/at most 5 items/i)).toBeInTheDocument();
  });

  it('de-selects an item when clicked again in modal', () => {
    render(<AIGenView moodboardId="board-1" />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    const dialog = screen.getByRole('dialog');
    const itemBtns = within(dialog).getAllByRole('button').filter(btn => !btn.dataset.testid);
    fireEvent.click(itemBtns[0]); // select
    fireEvent.click(itemBtns[0]); // deselect
    fireEvent.click(screen.getByTestId('modal-ok'));
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });
});

// ─── selected item actions ────────────────────────────────────────────────────
describe('selected item actions', () => {
  const imageItems = [{ id: 'img-1', src: 'http://example.com/img1.jpg' }];

  beforeEach(() => {
    useBoardStore.mockReturnValue({ items: imageItems });
  });

  const selectFirstItem = () => {
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    const dialog = screen.getByRole('dialog');
    const itemBtns = within(dialog).getAllByRole('button').filter(btn => !btn.dataset.testid);
    fireEvent.click(itemBtns[0]);
    fireEvent.click(screen.getByTestId('modal-ok'));
  };

  it('removes selected item when Remove is clicked', () => {
    render(<AIGenView moodboardId="board-1" />);
    selectFirstItem();
    const removeBtn = screen.getByRole('button', { name: 'Remove' });
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });
});

// ─── room image upload ────────────────────────────────────────────────────────
describe('room image upload', () => {
  it('shows preview after a file is uploaded', async () => {
    render(<AIGenView moodboardId="board-1" />);
    expect(screen.getByText(/Drop an image here/i)).toBeInTheDocument();

    const fileInput = screen.getByTestId('dragger-file-input');
    const file = new File(['img'], 'room.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // placeholder disappears, room preview img appears
    expect(screen.queryByText(/Drop an image here/i)).not.toBeInTheDocument();
    expect(screen.getByAltText('Room')).toBeInTheDocument();
  });

  it('removes room image when Remove is clicked', async () => {
    render(<AIGenView moodboardId="board-1" />);
    const fileInput = screen.getByTestId('dragger-file-input');
    const file = new File(['img'], 'room.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    expect(screen.getByAltText('Room')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByAltText('Room')).not.toBeInTheDocument();
    expect(screen.getByText(/Drop an image here/i)).toBeInTheDocument();
  });
});

// ─── generate disabled state ──────────────────────────────────────────────────
describe('generate button disabled state', () => {
  it('is disabled when no items are selected', () => {
    useBoardStore.mockReturnValue({
      items: [{ id: 'img-1', src: 'http://example.com/img.jpg' }],
    });
    render(<AIGenView moodboardId="board-1" />);
    const generateBtn = screen.getByRole('button', { name: /generate/i });
    expect(generateBtn).toBeDisabled();
  });
});

// ─── generate action ──────────────────────────────────────────────────────────
describe('generate action', () => {
  const imageItems = [{ id: 'img-1', src: 'http://example.com/img1.jpg' }];

  beforeEach(() => {
    useBoardStore.mockReturnValue({ items: imageItems });
  });

  const selectFirstAndGenerate = async () => {
    fireEvent.click(screen.getByRole('button', { name: /\+ Select Items/i }));
    const dialog = await screen.findByRole('dialog');
    const itemBtns = within(dialog).getAllByRole('button').filter(btn => !btn.dataset.testid);
    fireEvent.click(itemBtns[0]);
    fireEvent.click(screen.getByTestId('modal-ok'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const generateBtn = screen.getByRole('button', { name: /generate/i });
    fireEvent.click(generateBtn);
  };

  it('shows error when moodboardId is "new"', async () => {
    render(<AIGenView moodboardId="new" />);
    await selectFirstAndGenerate();
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('Save the moodboard first.');
    });
  });

  it('calls onGenerationCreated and shows success on successful generation', async () => {
    const onGenerationCreated = jest.fn();
    global.fetch
      .mockResolvedValueOnce(usageOk())                                    // usage on mount
      .mockResolvedValueOnce({                                             // item image fetch
        ok: true,
        blob: async () => new Blob(['imgdata'], { type: 'image/png' }),
      })
      .mockResolvedValueOnce({                                             // generation API
        ok: true,
        status: 200,
        json: async () => ({ generation: { id: 'gen-1', imageUrl: 'http://example.com/gen.png' } }),
        text: async () => '',
      })
      .mockResolvedValueOnce(usageOk());                                   // usage refresh

    render(<AIGenView moodboardId="board-123" onGenerationCreated={onGenerationCreated} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1)); // usage loaded

    await selectFirstAndGenerate();
    await waitFor(() => {
      expect(onGenerationCreated).toHaveBeenCalledWith({
        id: 'gen-1',
        imageUrl: 'http://example.com/gen.png',
      });
      expect(mockMessage.success).toHaveBeenCalledWith(
        'Generation successful! Check the Generations tab.'
      );
    });
  });

  it('shows error on failed generation', async () => {
    global.fetch
      .mockResolvedValueOnce(usageOk())
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['img'], { type: 'image/png' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server error' })
      .mockResolvedValueOnce(usageOk());

    render(<AIGenView moodboardId="board-123" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await selectFirstAndGenerate();
    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('shows deny popover on 403 backend limit', async () => {
    global.fetch
      .mockResolvedValueOnce(usageOk())
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['img'], { type: 'image/png' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Quota exceeded' }),
        text: async () => 'Quota exceeded',
      })
      .mockResolvedValueOnce(usageOk());

    render(<AIGenView moodboardId="board-123" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await selectFirstAndGenerate();
    await waitFor(() => {
      expect(screen.getByText('Out of tokens')).toBeInTheDocument();
    });
  });
});
