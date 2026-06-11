// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ModelSelect from '../../src/components/ModelSelect';

const MODELS = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro'];

afterEach(() => {
  cleanup();
});

describe('ModelSelect', () => {
  it('渲染输入框', () => {
    render(<ModelSelect models={MODELS} value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('输入或选择模型...')).toBeDefined();
  });

  it('显示当前 value', () => {
    render(<ModelSelect models={MODELS} value="gpt-4" onChange={() => {}} />);
    expect(screen.getByDisplayValue('gpt-4')).toBeDefined();
  });

  it('聚焦后显示下拉列表', () => {
    render(<ModelSelect models={MODELS} value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('输入或选择模型...');
    fireEvent.focus(input);
    expect(screen.getByText('gpt-4')).toBeDefined();
    expect(screen.getByText('claude-3-opus')).toBeDefined();
  });

  it('输入文字过滤列表', () => {
    render(<ModelSelect models={MODELS} value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('输入或选择模型...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'claude' } });
    expect(screen.getByText('claude-3-opus')).toBeDefined();
    expect(screen.getByText('claude-3-sonnet')).toBeDefined();
    expect(screen.queryByText('gpt-4')).toBeNull();
  });

  it('选择模型后调用 onChange 并关闭下拉', () => {
    const onChange = vi.fn();
    render(<ModelSelect models={MODELS} value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('输入或选择模型...');
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText('gpt-4'));
    expect(onChange).toHaveBeenCalledWith('gpt-4');
  });

  it('Escape 关闭下拉', () => {
    render(<ModelSelect models={MODELS} value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('输入或选择模型...');
    fireEvent.focus(input);
    expect(screen.getByText('gpt-4')).toBeDefined();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('gpt-4')).toBeNull();
  });

  it('Enter 选择唯一匹配项', () => {
    const onChange = vi.fn();
    render(<ModelSelect models={MODELS} value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('输入或选择模型...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'gemini' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('gemini-pro');
  });

  it('loading 状态显示提示', () => {
    render(<ModelSelect models={[]} value="" onChange={() => {}} loading />);
    expect(screen.getByText('正在获取模型列表...')).toBeDefined();
  });
});
