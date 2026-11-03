'use client';

/** Botão de envio que pede confirmação antes de executar a ação do formulário. */
export default function ConfirmButton({ message, children, ...props }) {
  return (
    <button
      {...props}
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
