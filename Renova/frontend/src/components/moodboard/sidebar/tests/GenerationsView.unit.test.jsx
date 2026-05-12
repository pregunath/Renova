import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import GenerationsView from '../GenerationsView';

// ─── next/navigation: override useParams to be configurable per test ──────────
const mockUseParams = jest.fn(() => ({ id: 'test-board-id' }));
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  useParams: () => mockUseParams(),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ─── antd mock ────────────────────────────────────────────────────────────────
jest.mock('antd', () => {
  const React = require('react');
  return {
    Spin: () => <div data-testid="spin">Loading...</div>,
    Empty: ({ description }) => <div data-testid="empty">{description}</div>,
    Image: ({ preview }) =>
      preview?.visible
        ? <img data-testid="preview-img" src={preview.src} alt="preview" />
        : null,
    message: { error: jest.fn(), success: jest.fn() },
  };
});

const mockMessage = require('antd').message;

// ─── helpers ─────────────────────────────────────────────────────────────────
const mockSetGenerationResults = jest.fn();

const okResponse = (data) => ({
  ok: true,
  json: async () => data,
  text: async () => '',
  blob: async () => new Blob(['data'], { type: 'image/png' }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseParams.mockReturnValue({ id: 'test-board-id' });
  global.fetch.mockResolvedValue(okResponse({ generations: [] }));
});

// ─── loading state ────────────────────────────────────────────────────────────
describe('loading state', () => {
  it('shows loading spinner while fetch is pending', async () => {
    // fetch never resolves so we stay in loading state
    global.fetch.mockReturnValue(new Promise(() => {}));
    render(<GenerationsView generationResults={[]} setGenerationResults={mockSetGenerationResults} />);
    expect(screen.getByTestId('spin')).toBeInTheDocument();
  });
});

// ─── empty state ─────────────────────────────────────────────────────────────
describe('empty state', () => {
  it('shows empty message when fetch returns no generations', async () => {
    global.fetch.mockResolvedValue(okResponse({ generations: [] }));
    render(<GenerationsView generationResults={[]} setGenerationResults={mockSetGenerationResults} />);
    await waitFor(() => {
      expect(mockSetGenerationResults).toHaveBeenCalledWith([]);
    });
    render(<GenerationsView generationResults={[]} setGenerationResults={mockSetGenerationResults} />);
    await waitFor(() => {
      expect(screen.getByText(/Your AI generations will be displayed here/i)).toBeInTheDocument();
    });
  });

  it('does not show loading spinner once fetch completes', async () => {
    global.fetch.mockResolvedValue(okResponse({ generations: [] }));
    render(<GenerationsView generationResults={[]} setGenerationResults={mockSetGenerationResults} />);
    await waitFor(() => expect(mockSetGenerationResults).toHaveBeenCalled());
    // render again with empty results to confirm no spinner
    const { container } = render(
      <GenerationsView generationResults={[]} setGenerationResults={jest.fn()} />
    );
    await waitFor(() => {
      expect(screen.queryByTestId('spin')).not.toBeInTheDocument();
    });
  });
});

// ─── successful generation list ───────────────────────────────────────────────
describe('generation list rendering', () => {
  const generations = [
    { id: 'g1', imageUrl: 'http://example.com/gen1.png' },
    { id: 'g2', imageUrl: 'http://example.com/gen2.png' },
  ];

  it('renders one View and Download button per generation', () => {
    render(
      <GenerationsView
        generationResults={generations}
        setGenerationResults={mockSetGenerationResults}
      />
    );
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Download' })).toHaveLength(2);
  });

  it('renders images with correct absolute src', () => {
    render(
      <GenerationsView
        generationResults={generations}
        setGenerationResults={mockSetGenerationResults}
      />
    );
    // alt="" gives role="presentation", so use querySelectorAll
    const imgs = Array.from(document.querySelectorAll('img'));
    const srcs = imgs.map(img => img.getAttribute('src'));
    expect(srcs).toContain('http://example.com/gen1.png');
    expect(srcs).toContain('http://example.com/gen2.png');
  });

  it('prefixes relative imageUrl with API_BASE_URL env var', () => {
    const relGen = [{ id: 'g3', imageUrl: '/generations/foo.png' }];
    render(
      <GenerationsView
        generationResults={relGen}
        setGenerationResults={mockSetGenerationResults}
      />
    );
    const imgs = Array.from(document.querySelectorAll('img'));
    const found = imgs.find(i => i.getAttribute('src')?.includes('foo.png'));
    expect(found).toBeDefined();
  });
});

// ─── preview ─────────────────────────────────────────────────────────────────
describe('preview', () => {
  const generations = [{ id: 'g1', imageUrl: 'http://example.com/gen1.png' }];

  it('clicking View opens the preview', () => {
    render(
      <GenerationsView
        generationResults={generations}
        setGenerationResults={mockSetGenerationResults}
      />
    );
    expect(screen.queryByTestId('preview-img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(screen.getByTestId('preview-img')).toBeInTheDocument();
  });
});

// ─── download ────────────────────────────────────────────────────────────────
describe('download', () => {
  const generations = [{ id: 'g1', imageUrl: 'http://example.com/gen1.png' }];

  it('fetches the image, creates a blob URL, and triggers anchor click', async () => {
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    global.fetch.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['img'], { type: 'image/png' }),
      json: async () => ({ generations: [] }),
      text: async () => '',
    });

    render(
      <GenerationsView
        generationResults={generations}
        setGenerationResults={mockSetGenerationResults}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    clickSpy.mockRestore();
  });

  it('shows error message when download fetch fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ generations: [] }),
      text: async () => '',
    });

    render(
      <GenerationsView
        generationResults={generations}
        setGenerationResults={mockSetGenerationResults}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    });

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith('Failed to download generation.');
    });
  });
});

// ─── moodboardId = 'new' ─────────────────────────────────────────────────────
describe('moodboardId = "new"', () => {
  it('calls setGenerationResults([]) without fetching', async () => {
    mockUseParams.mockReturnValue({ id: 'new' });
    render(
      <GenerationsView
        generationResults={[]}
        setGenerationResults={mockSetGenerationResults}
      />
    );
    await waitFor(() => {
      expect(mockSetGenerationResults).toHaveBeenCalledWith([]);
    });
    // No fetch to /api/generation should have been made
    const generationFetchCalls = global.fetch.mock.calls.filter(([url]) =>
      url && url.includes('/api/generation')
    );
    expect(generationFetchCalls).toHaveLength(0);
  });
});

// ─── reload on moodboardId change ────────────────────────────────────────────
describe('reload when moodboardId changes', () => {
  it('fetches again when moodboardId changes', async () => {
    mockUseParams.mockReturnValue({ id: 'board-1' });
    global.fetch.mockResolvedValue(okResponse({ generations: [] }));

    const { rerender } = render(
      <GenerationsView
        generationResults={[]}
        setGenerationResults={mockSetGenerationResults}
      />
    );

    await waitFor(() => expect(mockSetGenerationResults).toHaveBeenCalledTimes(1));

    // Change moodboardId
    mockUseParams.mockReturnValue({ id: 'board-2' });
    rerender(
      <GenerationsView
        generationResults={[]}
        setGenerationResults={mockSetGenerationResults}
      />
    );

    await waitFor(() => expect(mockSetGenerationResults).toHaveBeenCalledTimes(2));

    const urls = global.fetch.mock.calls.map(([url]) => url);
    const generationUrls = urls.filter(url => url && url.includes('/api/generation/board/'));
    expect(generationUrls.some(u => u.includes('board-1'))).toBe(true);
    expect(generationUrls.some(u => u.includes('board-2'))).toBe(true);
  });
});
