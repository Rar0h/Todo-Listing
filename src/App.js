import { useState } from "react";
import "./App.css";

function App() {
  const [inputValue, setInput] = useState(""); // Состояние для ввода
  const [tasks, setTasks] = useState([]); // Состояние для списка задач

  function addTask() {
    if (inputValue.trim() === "") {
      alert("Task name cannot be empty. Please enter a task.");
    } else {
      const newTask = {
        id: Date.now(), // Уникальный ID для каждой задачи
        text: inputValue
      };
      setTasks([...tasks, newTask]); // Добавляем новую задачу
      setInput(""); // Очищаем поле ввода
    }
  }

  function deleteTask(id) {
    // Удаляем задачу по ID
    setTasks(tasks.filter(task => task.id !== id));
  }

  function editTask(id) {
    const editedValue = prompt("Edit the task Name");
    if (editedValue !== null && editedValue.trim() !== "") {
      // Обновляем текст задачи
      setTasks(tasks.map(task =>
        task.id === id ? { ...task, text: editedValue } : task
      ));
    }
  }

  return (
    <div className="container">
      <h1 className="app-title">Мой список задач</h1>
      <div className="todo-container">
        <input
          type="text"
          value={inputValue}
          onChange={(event) => {
            setInput(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              addTask(); // Добавление по Enter
            }
          }}
        />
        <button onClick={addTask}>Задать</button>
      </div>
      <ol className="list-container">
        {/* Рендерим задачи через map */}
        {tasks.map((task) => (
          <li key={task.id}>
            <span>{task.text}</span>
            <button onClick={() => editTask(task.id)}>Edit</button>
            <button onClick={() => deleteTask(task.id)}>Delete</button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default App;