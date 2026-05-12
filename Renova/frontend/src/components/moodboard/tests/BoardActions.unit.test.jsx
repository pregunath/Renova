import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BoardActions from '../BoardActions';
import { useBoardStore } from '@/contexts/boardStore';

jest.mock('next/image', () => function MockImage({ alt }) { return <img alt={alt} />; });
jest.mock('@/contexts/boardStore', () => ({ useBoardStore: jest.fn() }));

const mockSetItems = jest.fn();
const mockPushHistory = jest.fn();
const mockSetMode = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useBoardStore.mockReturnValue({
    setItems: mockSetItems,
    pushHistory: mockPushHistory,
    setMode: mockSetMode,
  });
  useBoardStore.getState = jest.fn(() => ({ mode: 'idle' }));
});

describe('BoardActions rendering', () => {
  it('renders all 6 action buttons', () => {
    render(<BoardActions />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Background' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add text' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add drawing' })).toBeInTheDocument();
  });
});

describe('image button', () => {
  it('triggers the hidden file input click', () => {
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add image' }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});

describe('file input onChange', () => {
  it('calls onFilesSelected with the selected files', () => {
    const onFilesSelected = jest.fn();
    render(<BoardActions onFilesSelected={onFilesSelected} />);
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it('does not call onFilesSelected when no files selected', () => {
    const onFilesSelected = jest.fn();
    render(<BoardActions onFilesSelected={onFilesSelected} />);
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(onFilesSelected).not.toHaveBeenCalled();
  });
});

describe('text button', () => {
  it('calls pushHistory and setMode("idle")', () => {
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
    expect(mockPushHistory).toHaveBeenCalledTimes(1);
    expect(mockSetMode).toHaveBeenCalledWith('idle');
  });

  it('calls setItems with a function that adds a text item', () => {
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
    expect(mockSetItems).toHaveBeenCalledTimes(1);
    const updater = mockSetItems.mock.calls[0][0];
    const result = updater([]);
    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item.kind).toBe('text');
    expect(item.text).toBe('Double-click to edit');
    expect(item.w).toBe(260);
    expect(item.fontSize).toBe(28);
    expect(item.fontFamily).toBe('Arial');
    expect(item.rot).toBe(0);
  });

  it('assigns z above the highest existing item z', () => {
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
    const updater = mockSetItems.mock.calls[0][0];
    const result = updater([{ id: 'a', z: 7 }, { id: 'b', z: 3 }]);
    expect(result[result.length - 1].z).toBe(8);
  });

  it('assigns z of 1 when board is empty', () => {
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }));
    const updater = mockSetItems.mock.calls[0][0];
    const result = updater([]);
    expect(result[0].z).toBe(1);
  });
});

describe('pen button', () => {
  it('sets mode to "draw" when current mode is "idle"', () => {
    useBoardStore.getState = jest.fn(() => ({ mode: 'idle' }));
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add drawing' }));
    expect(mockSetMode).toHaveBeenCalledWith('draw');
  });

  it('sets mode to "idle" when current mode is "draw"', () => {
    useBoardStore.getState = jest.fn(() => ({ mode: 'draw' }));
    render(<BoardActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Add drawing' }));
    expect(mockSetMode).toHaveBeenCalledWith('idle');
  });
});

describe('background button', () => {
  it('calls setMode("bg") and onAction("bg")', () => {
    const onAction = jest.fn();
    render(<BoardActions onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    expect(mockSetMode).toHaveBeenCalledWith('bg');
    expect(onAction).toHaveBeenCalledWith('bg');
  });

  it('does not throw when onAction is omitted', () => {
    render(<BoardActions />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Background' }))).not.toThrow();
  });
});

describe('save and export buttons', () => {
  it('calls onAction("save")', () => {
    const onAction = jest.fn();
    render(<BoardActions onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onAction).toHaveBeenCalledWith('save');
  });

  it('calls onAction("export")', () => {
    const onAction = jest.fn();
    render(<BoardActions onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onAction).toHaveBeenCalledWith('export');
  });
});

describe('disabled states', () => {
  it('disables save button when disabled.save is true', () => {
    render(<BoardActions disabled={{ save: true }} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('disables image button when disabled.image is true', () => {
    render(<BoardActions disabled={{ image: true }} />);
    expect(screen.getByRole('button', { name: 'Add image' })).toBeDisabled();
  });

  it('all buttons enabled when disabled is empty object', () => {
    render(<BoardActions disabled={{}} />);
    screen.getAllByRole('button').forEach(btn => expect(btn).not.toBeDisabled());
  });

  it('all buttons enabled when disabled prop is omitted', () => {
    render(<BoardActions />);
    screen.getAllByRole('button').forEach(btn => expect(btn).not.toBeDisabled());
  });
});
