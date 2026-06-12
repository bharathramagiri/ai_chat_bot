import gradio as gr

def greet(name):
    return "Hello " + name + "! Welcome to my Hugging Face website!"

# Create the web interface
demo = gr.Interface(
    fn=greet,
    inputs="text",
    outputs="text",
    title="My First HF App",
    description="Type your name below to see it work."
)

# Launch the website
demo.launch()