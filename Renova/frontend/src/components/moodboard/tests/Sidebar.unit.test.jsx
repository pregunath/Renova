import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

jest.mock('../sidebar/PinterestView', () => () => <div data-testid="pinterest-view" />);
jest.mock('../sidebar/AIGenView', () =>
  function MockAIGenView({ moodboardId }) {
    return <div data-testid="aigen-view" data-moodboard-id={moodboardId} />;
  }
);
jest.mock('../sidebar/GenerationsView', () =>
  function MockGenerationsView({ generationResults }) {
    return <div data-testid="generations-view" data-count={generationResults?.length ?? 0} />;
  }
);

const defaultProps = {
  moodboardId: 'board-123',
  generationResults: [],
  setGenerationResults: jest.fn(),
  onGenerationCreated: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('default tab state', () => {
  it('"AI Gen" tab is selected by default', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByRole('tab', { name: 'AI Gen' })).toHaveAttribute('aria-selected', 'true');
  });

  it('"Pinterest" and "Generations" are not selected by default', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByRole('tab', { name: 'Pinterest' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Generations' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders exactly 3 tab buttons', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});

describe('tab switching', () => {
  it('clicking Pinterest makes it active and deactivates others', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pinterest' }));
    expect(screen.getByRole('tab', { name: 'Pinterest' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'AI Gen' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'Generations' })).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking Generations makes it active and deactivates others', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Generations' }));
    expect(screen.getByRole('tab', { name: 'Generations' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Pinterest' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: 'AI Gen' })).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking back to AI Gen after switching restores it', () => {
    render(<Sidebar {...defaultProps} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pinterest' }));
    fireEvent.click(screen.getByRole('tab', { name: 'AI Gen' }));
    expect(screen.getByRole('tab', { name: 'AI Gen' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Pinterest' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('panel rendering', () => {
  it('all 3 panel components are always mounted in the DOM', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByTestId('pinterest-view')).toBeInTheDocument();
    expect(screen.getByTestId('aigen-view')).toBeInTheDocument();
    expect(screen.getByTestId('generations-view')).toBeInTheDocument();
  });
});

describe('prop forwarding', () => {
  it('forwards moodboardId to AIGenView', () => {
    render(<Sidebar {...defaultProps} moodboardId="my-board-id" />);
    expect(screen.getByTestId('aigen-view')).toHaveAttribute('data-moodboard-id', 'my-board-id');
  });

  it('forwards generationResults length to GenerationsView', () => {
    const results = [{ id: 'g1' }, { id: 'g2' }];
    render(<Sidebar {...defaultProps} generationResults={results} />);
    expect(screen.getByTestId('generations-view')).toHaveAttribute('data-count', '2');
  });

  it('accepts onGenerationCreated without errors', () => {
    expect(() => render(<Sidebar {...defaultProps} onGenerationCreated={jest.fn()} />)).not.toThrow();
  });
});
