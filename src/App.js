import { useState, useRef } from "react";
import "./App.css";

function App() {
  let [inputValue, setInput] = useState("");
  let olRef = useRef(null);

  function addTask() {
    if (inputValue === "") {
      alert("Task name cannot be empty. Please enter a task.");
    } else {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.innerText = `${inputValue}`;
      li.appendChild(span);
      olRef.current.appendChild(li);
      const editBtn = document.createElement("button");
      editBtn.innerText = "Edit";
      li.appendChild(editBtn);
      const deleteBtn = document.createElement("button");
      deleteBtn.innerText = "Delete";
      li.appendChild(deleteBtn);
    }
    setInput("");
  }

  function handleTask(event) {
    if (event.target.textContent === "Delete") {
      event.target.parentNode.remove();
    } else if (event.target.textContent === "Edit") {
      const editedValue = prompt("Edit the task Name");
      event.target.parentNode.childNodes[0].innerText = `${editedValue}`;
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
        />
        <button onClick={addTask}>Задать</button>
      </div>
      <ol className="list-container" ref={olRef} onClick={handleTask}></ol>
    </div>
  );
}

export default App;
