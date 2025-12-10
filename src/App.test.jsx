import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

global.prompt = jest.fn();

describe('App — Список задач', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.prompt.mockImplementation(() => 'Отредактированная задача');
  });

  it('renders title and input elements', () => {
    render(<App />);

    expect(screen.getByText('Мой список задач')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Задать' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument(); // <ol>
  });

  it('shows alert when trying to add empty task', () => {
    global.alert = jest.fn();

    render(<App />);

    const addButton = screen.getByRole('button', { name: 'Задать' });
    fireEvent.click(addButton);

    expect(global.alert).toHaveBeenCalledWith(
      'Task name cannot be empty. Please enter a task.'
    );
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument(); // нет задач
  });

  it('adds a new task to the list', () => {
    render(<App />);

    const input = screen.getByRole('textbox');
    const addButton = screen.getByRole('button', { name: 'Задать' });

    fireEvent.change(input, { target: { value: 'Купить молоко' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Купить молоко')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    expect(input).toHaveValue('');
  });

  it('deletes a task when Delete button is clicked', () => {
    render(<App />);

    const input = screen.getByRole('textbox');
    const addButton = screen.getByRole('button', { name: 'Задать' });

    fireEvent.change(input, { target: { value: 'Прогуляться' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Прогуляться')).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteBtn);

    expect(screen.queryByText('Прогуляться')).not.toBeInTheDocument();
  });

  it('edits a task when Edit button is clicked', () => {
    render(<App />);

    const input = screen.getByRole('textbox');
    const addButton = screen.getByRole('button', { name: 'Задать' });

    fireEvent.change(input, { target: { value: 'Почитать книгу' } });
    fireEvent.click(addButton);

    expect(screen.getByText('Почитать книгу')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editBtn);

    expect(global.prompt).toHaveBeenCalledWith('Edit the task Name');

    expect(screen.getByText('Отредактированная задача')).toBeInTheDocument();
  });

  it('does not add task if prompt is cancelled (null)', () => {
    global.prompt.mockImplementation(() => null);

    render(<App />);

    const input = screen.getByRole('textbox');
    const addButton = screen.getByRole('button', { name: 'Задать' });

    fireEvent.change(input, { target: { value: 'Сделать тест' } });
    fireEvent.click(addButton);

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editBtn);

    expect(screen.getByText('Сделать тест')).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});