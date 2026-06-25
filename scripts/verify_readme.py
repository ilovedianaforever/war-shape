import os

def check():
    with open('README.md', 'r', encoding='utf-8') as f:
        c = f.read()
    # Must be removed
    for s in ['第五部分', '第六部分', '第七部分', '第八部分', '第十部分', 'tide-of-conflict', '开源项目溯源', '文件夹改名']:
        assert s not in c, f'ERROR: Still contains "{s}"'
        print(f'OK removed: {s}')
    # Should remain
    for s in ['第一部分', '第二部分', '第三部分', '第四部分', '队友交付指南']:
        assert s in c, f'ERROR: Missing "{s}"'
        print(f'OK kept: {s}')
    
    # Check personal file
    with open('个人工作量.md', 'r', encoding='utf-8') as f:
        p = f.read()
    for s in ['项目清理','修复的全部 Bug','新增依赖','改动的文件清单','数据补充']:
        assert s in p, f'ERROR: personal file missing "{s}"'
        print(f'OK personal: {s}')
    
    print(f'\nREADME: {len(c)} chars')
    print(f'个人工作量: {len(p)} chars')
    print('ALL CHECKS PASSED')

os.chdir(os.path.dirname(os.path.abspath(__file__)))
check()
