import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../Toolbar';
import { useBoardStore } from '@/contexts/boardStore';

jest.mock('next/image', () => function MockImage({ alt }) { return <img alt={alt} />; });
jest.mock('@/contexts/boardStore', () => ({ useBoardStore: jest.fn() }));

const mockDuplicateSelected = jest.fn();
const mockDeleteSelected = jest.fn();
const mockMoveForward = jest.fn();
const mockMoveBackward = jest.fn();
const mockMirrorSelected = jest.fn();
const mockToggleShadow = jest.fn();
const mockStartCrop = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useBoardStore.mockReturnValue({
    duplicateSelected: mockDuplicateSelected,
    deleteSelected: mockDeleteSelected,
    moveForward: mockMoveForward,
    moveBackward: mockMoveBackward,
    mirrorSelected: mockMirrorSelected,
    toggleShadow: mockToggleShadow,
    startCrop: mockStartCrop,
  });
});

describe('Toolbar rendering', () => {
  it('renders all 8 tool buttons', () => {
    render(<Toolbar />);
    expect(screen.getByRole('button', { name: 'Remove BG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shadow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crop' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mirror' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});

describe('tool button → store action wiring', () => {
  it('Mirror → mirrorSelected()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mirror' }));
    expect(mockMirrorSelected).toHaveBeenCalledTimes(1);
  });

  it('Duplicate → duplicateSelected()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(mockDuplicateSelected).toHaveBeenCalledTimes(1);
  });

  it('Forward → moveForward()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(mockMoveForward).toHaveBeenCalledTimes(1);
  });

  it('Backward → moveBackward()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Backward' }));
    expect(mockMoveBackward).toHaveBeenCalledTimes(1);
  });

  it('Delete → deleteSelected()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeleteSelected).toHaveBeenCalledTimes(1);
  });

  it('Shadow → toggleShadow()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Shadow' }));
    expect(mockToggleShadow).toHaveBeenCalledTimes(1);
  });

  it('Crop → startCrop()', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));
    expect(mockStartCrop).toHaveBeenCalledTimes(1);
  });

  it('Remove BG → no store action called (no handler for key="bg")', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove BG' }));
    expect(mockMirrorSelected).not.toHaveBeenCalled();
    expect(mockDuplicateSelected).not.toHaveBeenCalled();
    expect(mockMoveForward).not.toHaveBeenCalled();
    expect(mockMoveBackward).not.toHaveBeenCalled();
    expect(mockDeleteSelected).not.toHaveBeenCalled();
    expect(mockToggleShadow).not.toHaveBeenCalled();
    expect(mockStartCrop).not.toHaveBeenCalled();
  });
});

describe('no cross-firing', () => {
  it('Mirror only fires mirrorSelected, not others', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Mirror' }));
    expect(mockMirrorSelected).toHaveBeenCalledTimes(1);
    expect(mockDuplicateSelected).not.toHaveBeenCalled();
    expect(mockDeleteSelected).not.toHaveBeenCalled();
    expect(mockStartCrop).not.toHaveBeenCalled();
  });

  it('Delete only fires deleteSelected, not others', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mockDeleteSelected).toHaveBeenCalledTimes(1);
    expect(mockMirrorSelected).not.toHaveBeenCalled();
    expect(mockDuplicateSelected).not.toHaveBeenCalled();
    expect(mockStartCrop).not.toHaveBeenCalled();
  });

  it('Crop only fires startCrop, not others', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Crop' }));
    expect(mockStartCrop).toHaveBeenCalledTimes(1);
    expect(mockDeleteSelected).not.toHaveBeenCalled();
    expect(mockMirrorSelected).not.toHaveBeenCalled();
  });
});
